// Loads the processed Orphadata JSON, builds lookup indices, and holds the
// filtering / scoring logic that all views share.
import { state, version } from './state.js';

export let D = null;

// Midpoint of each HPO frequency class, used to weight a matched sign.
export const FREQ_WEIGHT = [0, 0.025, 0.17, 0.55, 0.9, 1];
export const FREQ_SHORT = ['Excluded', 'Very rare', 'Occasional', 'Frequent', 'Very frequent', 'Obligate'];
export const FREQ_RANGE = ['0%', '1–4%', '5–29%', '30–79%', '80–99%', '100%'];
export const PREV_SHORT = ['<1 / 1M', '1–9 / 1M', '1–9 / 100k', '1–5 / 10k', '6–9 / 10k', '>1 / 1k'];
export const LEVEL_SHORT = ['Group', 'Disorder', 'Subtype'];

/** Label for a representative prevalence class, including the two "missing" states. */
export function prevLabel(pc) {
  if (pc === -2) return 'No record';
  if (pc === -1) return 'Unknown';
  return PREV_SHORT[pc];
}

export async function loadData() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/orphadata.json`);
  if (!res.ok) throw new Error(`Could not load data (${res.status})`);
  const raw = await res.json();

  const genes = raw.genes.map(([symbol, name, locus], idx) => ({ idx, symbol, name, locus, diseases: [] }));
  const signs = raw.signs.map(([id, term], idx) => ({ idx, id, term, lower: term.toLowerCase(), n: 0 }));
  const specialties = raw.specialties.map((s, idx) => ({ ...s, idx }));

  const diseases = raw.diseases.map((r, idx) => {
    const links = [];
    for (let i = 0; i < r.g.length; i += 3) links.push({ g: r.g[i], a: r.g[i + 1], st: r.g[i + 2] });
    const gs = [...new Set(links.map((l) => l.g))];
    const signMap = new Map();
    for (let i = 0; i < r.h.length; i += 2) signMap.set(r.h[i], r.h[i + 1]);
    return {
      idx, code: r.c, name: r.n, lower: r.n.toLowerCase(), syn: r.y, synLower: r.y.map((y) => y.toLowerCase()),
      level: r.l, type: r.t, pref: r.p, specs: r.s, specKey: r.s.join(','),
      links, gs, signs: signMap, pc: r.pc, pb: r.pb, prev: r.pr, onset: r.o, inh: r.i,
    };
  });

  for (const d of diseases) {
    for (const g of d.gs) genes[g].diseases.push(d.idx);
    for (const s of d.signs.keys()) signs[s].n += 1;
  }

  D = {
    meta: raw.meta, vocab: raw.vocab, specialties, genes, signs, diseases,
    signByTerm: new Map(signs.map((s) => [s.term, s.idx])),
    topGenes: [...genes].sort((a, b) => b.diseases.length - a.diseases.length || a.symbol.localeCompare(b.symbol)),
  };
  return D;
}

// ---------------------------------------------------------------- filtering

/** Filters that do not involve clinical signs or the specialty selection. */
export function passesBase(d, s = state) {
  if (!s.levels.includes(d.level)) return false;
  if (s.onset.length && !d.onset.some((o) => s.onset.includes(o))) return false;
  if (s.inheritance.length && !d.inh.some((i) => s.inheritance.includes(i))) return false;
  if (s.prevClass.length && !s.prevClass.includes(d.pc)) return false;
  if (s.need.genes && !d.gs.length) return false;
  if (s.need.signs && !d.signs.size) return false;
  if (s.need.prev && d.pc < 0) return false;
  return true;
}

/**
 * Score a disease against the selected signs.
 * hits[i] is the frequency class of sign i in this disease (-1 = not annotated).
 * A sign counts as matched if its frequency is at least state.minFreq.
 * score = sum of frequency weights of the matched signs / number of signs asked for.
 */
export function scoreSigns(d, s = state) {
  const hits = s.signs.map((sign) => d.signs.get(sign) ?? -1);
  let matched = 0;
  let sum = 0;
  for (const f of hits) {
    if (f >= s.minFreq) {
      matched += 1;
      sum += FREQ_WEIGHT[f];
    }
  }
  return { hits, matched, score: s.signs.length ? sum / s.signs.length : 0 };
}

export function inSpecialtySelection(d, s = state) {
  if (!s.specialties.length) return true;
  if (s.specMode === 'exact') return d.specKey === [...s.specialties].sort((a, b) => a - b).join(',');
  return s.specialties.some((sp) => (s.countBy === 'pref' ? d.pref === sp : d.specs.includes(sp)));
}

let cache = { version: -1 };

/**
 * The diseases that pass every filter, as { d, hits, matched, score }.
 * With signs selected, a disease must match at least one and the list is
 * ranked by score; otherwise it is alphabetical. The specialty selection is
 * NOT applied here, because the overview needs the unselected set to draw it.
 */
export function getMatching() {
  if (cache.version === version) return cache.matching;
  const useSigns = state.signs.length > 0;
  const matching = [];
  for (const d of D.diseases) {
    if (!passesBase(d)) continue;
    if (useSigns) {
      const r = scoreSigns(d);
      if (r.matched > 0) matching.push({ d, ...r });
    } else {
      matching.push({ d, hits: [], matched: 0, score: 0 });
    }
  }
  if (useSigns) matching.sort((a, b) => b.score - a.score || b.matched - a.matched || a.d.name.localeCompare(b.d.name));
  cache = { version, matching };
  return matching;
}

/** Diseases at the chosen classification levels, before any other filter. */
export function getBase() {
  return D.diseases.filter((d) => state.levels.includes(d.level));
}

// ------------------------------------------------------------------- search

function rank(text, q) {
  const i = text.indexOf(q);
  if (i < 0) return -1;
  if (i === 0) return text.length === q.length ? 0 : 1;
  return /[\s\-(/,]/.test(text[i - 1]) ? 2 : 3;
}

function best(items, limit) {
  return items.sort((a, b) => a.r - b.r || a.tie - b.tie).slice(0, limit).map((x) => x.item);
}

export function searchDiseases(query, limit = 8) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const code = /^(orpha:?\s*)?\d+$/.test(q) ? Number(q.replace(/\D/g, '')) : null;
  const out = [];
  for (const d of D.diseases) {
    let r = rank(d.lower, q);
    if (r < 0 && d.synLower.some((y) => y.includes(q))) r = 4;
    if (code !== null && d.code === code) r = -1;
    else if (r < 0) continue;
    // Prefer disorders over groups and subtypes, then shorter names.
    out.push({ item: d, r, tie: (d.level === 1 ? 0 : 1000) + d.name.length });
  }
  return best(out, limit);
}

export function searchGenes(query, limit = 6) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out = [];
  for (const g of D.genes) {
    let r = rank(g.symbol.toLowerCase(), q);
    if (r < 0 && q.length > 2 && g.name.toLowerCase().includes(q)) r = 5;
    if (r < 0) continue;
    out.push({ item: g, r, tie: -g.diseases.length });
  }
  return best(out, limit);
}

export function searchSigns(query, limit = 8) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out = [];
  for (const s of D.signs) {
    let r = rank(s.lower, q);
    if (r < 0 && s.id.toLowerCase() === q) r = 0;
    if (r < 0) continue;
    out.push({ item: s, r, tie: -s.n });
  }
  return best(out, limit);
}

// --------------------------------------------------------------- similarity

/** Diseases whose sign profiles are closest to d (cosine on frequency weights). */
export function similarBySigns(d, limit = 5) {
  if (!d.signs.size) return [];
  let normA = 0;
  for (const f of d.signs.values()) normA += FREQ_WEIGHT[f] ** 2;
  const out = [];
  for (const o of D.diseases) {
    if (o === d || o.signs.size === 0) continue;
    let dot = 0;
    let normB = 0;
    for (const [s, f] of o.signs) {
      const w = FREQ_WEIGHT[f];
      normB += w * w;
      const fa = d.signs.get(s);
      if (fa !== undefined) dot += w * FREQ_WEIGHT[fa];
    }
    if (dot > 0) out.push({ d: o, sim: dot / Math.sqrt(normA * normB) });
  }
  return out.sort((a, b) => b.sim - a.sim).slice(0, limit);
}

/** Other diseases linked to at least one of d's genes. */
export function sharingGenes(d, limit = 6) {
  const seen = new Map();
  for (const g of d.gs) {
    for (const idx of D.genes[g].diseases) {
      if (idx !== d.idx) seen.set(idx, (seen.get(idx) || 0) + 1);
    }
  }
  return [...seen].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([idx]) => D.diseases[idx]);
}
