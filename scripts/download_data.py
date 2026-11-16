"""Download the Orphadata XML products used by the explorer into data/raw/.

Orphadata Science: Free access data from Orphanet. (c) INSERM 1999.
Available on https://sciences.orphadata.com/. Licensed CC BY 4.0.

Usage:  python scripts/download_data.py [--force]
"""
from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

BASE = "https://www.orphadata.com/data/xml/"
RAW = Path(__file__).resolve().parent.parent / "data" / "raw"

# The 35 classification hierarchies (product 3), one file per specialty.
CLASSIFICATION_IDS = [
    146, 147, 148, 150, 152, 156, 181, 182, 183, 184, 185, 186, 187, 188, 189,
    193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 209, 212,
    216, 231, 233, 234, 235,
]

FILES = [
    "en_product1.xml",       # nomenclature: names, synonyms, disorder type
    "en_product4.xml",       # HPO clinical signs with frequency
    "en_product6.xml",       # genes, association type, locus
    "en_product7.xml",       # linearisation: one preferential specialty
    "en_product9_prev.xml",  # epidemiology: prevalence
    "en_product9_ages.xml",  # natural history: age of onset, inheritance
] + [f"en_product3_{i}.xml" for i in CLASSIFICATION_IDS]


def main() -> None:
    force = "--force" in sys.argv
    RAW.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        dest = RAW / name
        if dest.exists() and dest.stat().st_size > 0 and not force:
            print(f"have  {name}")
            continue
        req = urllib.request.Request(BASE + name, headers={"User-Agent": "orphadata-explorer-pipeline"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = resp.read()
        dest.write_bytes(data)
        print(f"saved {name}  {len(data) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
