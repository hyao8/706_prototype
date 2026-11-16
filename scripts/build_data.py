"""Turn the Orphadata XML products in data/raw/ into one compact JSON file.

Reads the files fetched by download_data.py, keeps only the fields the explorer
needs, joins everything on the ORPHAcode and writes public/data/orphadata.json.

Usage:  python scripts/build_data.py
"""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

from lxml import etree

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "public" / "data" / "orphadata.json"

RELEASE = "July 2026"
ATTRIBUTION = (
    "Orphadata Science: Free access data from Orphanet. © INSERM 1999. "
    "Available on https://sciences.orphadata.com/. Data version July 2026. CC BY 4.0."
)

# ---- ordered vocabularies (index = rank) -----------------------------------
LEVELS = ["Group of disorders", "Disorder", "Subtype of disorder"]
# Weakest to strongest. "Excluded" is kept: it is knowledge, not missing data.
FREQ = [
    "Excluded (0%)",
    "Very rare (<4-1%)",
    "Occasional (29-5%)",
    "Frequent (79-30%)",
    "Very frequent (99-80%)",
    "Obligate (100%)",
]
# Rarest to most common.
PREV_CLASS = [
    "<1 / 1 000 000",
    "1-9 / 1 000 000",
    "1-9 / 100 000",
    "1-5 / 10 000",
    "6-9 / 10 000",
    ">1 / 1000",
]
ONSET = ["Antenatal", "Neonatal", "Infancy", "Childhood", "Adolescent", "Adult", "Elderly", "All ages"]
# Prevalence record types that can stand in for "how common is it", best first.
PREV_TYPE_PREF = ["Point prevalence", "Prevalence at birth", "Lifetime Prevalence"]
NO_DATA = {"No data available", "Not yet documented"}
INACTIVE_FLAG = "8192"

SHORT_LABELS = {
    "Rare developmental defect during embryogenesis": "Developmental anomalies",
    "Rare inborn error of metabolism": "Inborn errors of metabolism",
    "Rare systemic or rheumatologic disease": "Systemic / rheumatologic",
    "Rare systemic or rheumatological disease of childhood": "Systemic / rheumatologic (childhood)",
    "Rare disorder potentially indicated for transplant or complication after transplantation": "Transplant-related",
    "Rare disorder due to toxic effects": "Toxic effects",
    "Rare gynecologic or obstetric disease": "Gynecologic / obstetric",
    "Rare maxillo-facial surgical disease": "Maxillo-facial surgical",
    "Rare surgical cardiac disease": "Cardiac malformations (surgical)",
    "Rare circulatory system disease": "Circulatory system",
    "Rare infertility": "Infertility",
    "Pediatric cancer": "Pediatric cancer",
    "Functional head of classification for rare disorder without a determined diagnosis after full investigation": "Undetermined diagnosis",
}


def short_label(name: str) -> str:
    if name in SHORT_LABELS:
        return SHORT_LABELS[name]
    label = re.sub(r"^Rare ", "", name)
    label = re.sub(r" (disease|disorder)s?$", "", label)
    return label[:1].upper() + label[1:]


class Vocab:
    """Assigns a stable integer to each distinct string."""

    def __init__(self, initial: list[str] | None = None) -> None:
        self.items: list[str] = list(initial or [])
        self.index = {v: i for i, v in enumerate(self.items)}

    def add(self, value: str) -> int:
        if value not in self.index:
            self.index[value] = len(self.items)
            self.items.append(value)
        return self.index[value]


def text(node, path: str) -> str:
    return (node.findtext(path) or "").strip()


def disorders(filename: str, list_path: str = ".//DisorderList/Disorder"):
    tree = etree.parse(str(RAW / filename))
    return tree, tree.getroot().iterfind(list_path)


def main() -> None:
    # ---- 1. nomenclature: the master list of active entities ---------------
    tree, items = disorders("en_product1.xml")
    extracted = tree.getroot().get("date", "")[:10]
    types = Vocab()
    recs: dict[int, dict] = {}
    for d in items:
        flags = {f.text for f in d.iterfind("DisorderFlagList/DisorderFlag/Value")}
        if INACTIVE_FLAG in flags:
            continue
        code = int(text(d, "OrphaCode"))
        recs[code] = {
            "c": code,
            "n": text(d, "Name"),
            "y": [s.text.strip() for s in d.iterfind("SynonymList/Synonym") if s.text],
            "l": LEVELS.index(text(d, "DisorderGroup/Name")),
            "t": types.add(text(d, "DisorderType/Name")),
            "p": -1, "s": [], "g": [], "h": [], "pc": -2, "pb": "", "pr": [], "o": [], "i": [],
        }

    # ---- 2. classifications: every specialty a disease belongs to ----------
    specialties: list[dict] = []
    spec_by_code: dict[int, int] = {}
    for path in sorted(RAW.glob("en_product3_*.xml"), key=lambda p: int(p.stem.split("_")[-1])):
        cls = etree.parse(str(path)).getroot().find(".//Classification")
        root = cls.find("ClassificationNodeRootList/ClassificationNode/Disorder")
        root_code, root_name = int(text(root, "OrphaCode")), text(root, "Name")
        idx = len(specialties)
        specialties.append({"code": root_code, "name": root_name, "label": short_label(root_name)})
        spec_by_code[root_code] = idx
        for code in {int(e.text) for e in cls.iter("OrphaCode")}:
            if code in recs:
                recs[code]["s"].append(idx)

    # ---- 3. linearisation: one preferential specialty ----------------------
    _, items = disorders("en_product7.xml")
    for d in items:
        code = int(text(d, "OrphaCode"))
        target = d.find("DisorderDisorderAssociationList/DisorderDisorderAssociation/TargetDisorder")
        target_code = text(target, "OrphaCode") if target is not None else ""
        if code in recs and target_code.isdigit():
            recs[code]["p"] = spec_by_code.get(int(target_code), -1)
    for r in recs.values():
        # A preferential specialty is always also a membership.
        if r["p"] >= 0 and r["p"] not in r["s"]:
            r["s"].append(r["p"])
        r["s"].sort()

    # ---- 4. genes -----------------------------------------------------------
    assoc_types, assoc_status = Vocab(), Vocab()
    genes: dict[str, dict] = {}
    _, items = disorders("en_product6.xml")
    links: list[tuple[int, str, int, int]] = []
    for d in items:
        code = int(text(d, "OrphaCode"))
        if code not in recs:
            continue
        for a in d.iterfind("DisorderGeneAssociationList/DisorderGeneAssociation"):
            g = a.find("Gene")
            symbol = text(g, "Symbol")
            genes.setdefault(symbol, {
                "symbol": symbol,
                "name": text(g, "Name"),
                "locus": ", ".join(l.text for l in g.iterfind("LocusList/Locus/GeneLocus") if l.text),
            })
            a_type = re.sub(r" in$", "", text(a, "DisorderGeneAssociationType/Name"))
            links.append((code, symbol, assoc_types.add(a_type),
                          assoc_status.add(text(a, "DisorderGeneAssociationStatus/Name"))))
    gene_order = sorted(genes)
    gene_idx = {s: i for i, s in enumerate(gene_order)}
    for code, symbol, a_type, a_status in links:
        recs[code]["g"] += [gene_idx[symbol], a_type, a_status]

    # ---- 5. clinical signs (HPO) -------------------------------------------
    signs: dict[str, str] = {}
    sign_links: list[tuple[int, str, int]] = []
    tree = etree.parse(str(RAW / "en_product4.xml"))
    for st in tree.getroot().iterfind(".//HPODisorderSetStatus"):
        d = st.find("Disorder")
        code = int(text(d, "OrphaCode"))
        if code not in recs:
            continue
        for a in d.iterfind("HPODisorderAssociationList/HPODisorderAssociation"):
            hpo_id = text(a, "HPO/HPOId")
            signs[hpo_id] = text(a, "HPO/HPOTerm")
            sign_links.append((code, hpo_id, FREQ.index(text(a, "HPOFrequency/Name"))))
    sign_order = sorted(signs, key=lambda k: signs[k].lower())
    sign_idx = {k: i for i, k in enumerate(sign_order)}
    for code, hpo_id, freq in sign_links:
        recs[code]["h"] += [sign_idx[hpo_id], freq]

    # ---- 6. epidemiology ----------------------------------------------------
    prev_types, geos, valid = Vocab(), Vocab(), Vocab()
    _, items = disorders("en_product9_prev.xml")
    for d in items:
        code = int(text(d, "OrphaCode"))
        if code not in recs:
            continue
        r = recs[code]
        for p in d.iterfind("PrevalenceList/Prevalence"):
            cls_name = text(p, "PrevalenceClass/Name")
            cls = PREV_CLASS.index(cls_name) if cls_name in PREV_CLASS else -1
            try:
                val = float(text(p, "ValMoy") or 0)
            except ValueError:
                val = 0.0
            r["pr"].append([
                prev_types.add(text(p, "PrevalenceType/Name")),
                cls,
                # A mean value of 0 means "only a class is known", never a real zero.
                val if val > 0 else None,
                geos.add(text(p, "PrevalenceGeographic/Name")),
                valid.add(text(p, "PrevalenceValidationStatus/Name")),
                text(p, "PrevalenceQualification/Name"),
                text(p, "Source"),
            ])
        r["pc"], r["pb"] = representative_class(r["pr"], prev_types.items, geos.items, valid.items)

    # ---- 7. natural history -------------------------------------------------
    inheritance = Vocab()
    _, items = disorders("en_product9_ages.xml")
    for d in items:
        code = int(text(d, "OrphaCode"))
        if code not in recs:
            continue
        r = recs[code]
        for o in d.iterfind("AverageAgeOfOnsetList/AverageAgeOfOnset/Name"):
            if o.text in ONSET:
                r["o"].append(ONSET.index(o.text))
        for i in d.iterfind("TypeOfInheritanceList/TypeOfInheritance/Name"):
            if i.text and i.text not in NO_DATA:
                r["i"].append(inheritance.add(i.text))
        r["o"].sort()

    # ---- 8. write -----------------------------------------------------------
    diseases = sorted(recs.values(), key=lambda r: r["n"].lower())
    n_sign_links = sum(len(r["h"]) // 2 for r in diseases)
    n_gene_links = sum(len(r["g"]) // 3 for r in diseases)
    disorders_only = [r for r in diseases if r["l"] == 1]
    multi = sum(1 for r in disorders_only if len(r["s"]) > 1)
    meta = {
        "release": RELEASE,
        "extracted": extracted,
        "attribution": ATTRIBUTION,
        "counts": {
            "entities": len(diseases),
            "byLevel": [sum(1 for r in diseases if r["l"] == i) for i in range(3)],
            "genes": len(gene_order),
            "signs": len(sign_order),
            "geneLinks": n_gene_links,
            "signLinks": n_sign_links,
            "multiSpecialtyDisorders": multi,
        },
    }
    out = {
        "meta": meta,
        "vocab": {
            "levels": LEVELS, "types": types.items, "freq": FREQ,
            "assoc": assoc_types.items, "assocStatus": assoc_status.items,
            "prevClass": PREV_CLASS, "prevType": prev_types.items, "geo": geos.items,
            "valid": valid.items, "onset": ONSET, "inheritance": inheritance.items,
        },
        "specialties": specialties,
        "genes": [[genes[s]["symbol"], genes[s]["name"], genes[s]["locus"]] for s in gene_order],
        "signs": [[k, signs[k]] for k in sign_order],
        "diseases": diseases,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"wrote {OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1e6:.1f} MB")
    print(json.dumps(meta["counts"], indent=1))
    print(f"multi-specialty disorders: {multi / len(disorders_only):.1%}")
    pc = Counter(r["pc"] for r in disorders_only)
    print("prevalence class of disorders (-2 no record, -1 unknown):", sorted(pc.items()))


def representative_class(records, type_names, geo_names, valid_names) -> tuple[int, str]:
    """Pick one prevalence class per disease, and say what it is based on.

    Returns (class index, basis). Class -1 means records exist but none gives a
    usable class ("Unknown"); -2 (set by the caller's default) means no record.
    Order of preference: point prevalence, then prevalence at birth, then
    lifetime prevalence; within a type Worldwide, then Europe, then any region;
    validated before not validated; and finally the most common class.
    """
    def geo_rank(g: str) -> int:
        return {"Worldwide": 0, "Europe": 1}.get(g, 2)

    for wanted in PREV_TYPE_PREF:
        usable = [r for r in records if type_names[r[0]] == wanted and r[1] >= 0]
        if usable:
            best = min(usable, key=lambda r: (geo_rank(geo_names[r[3]]),
                                              valid_names[r[4]] != "Validated", -r[1]))
            return best[1], f"{wanted}, {geo_names[best[3]]}"
    return -1, ""


if __name__ == "__main__":
    main()
