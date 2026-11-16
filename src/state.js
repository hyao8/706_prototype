// One shared selection state. Every view reads it, writes to it through
// update(), and is redrawn when it changes.

export const defaults = () => ({
  page: 'overview', // 'overview' | 'disease' | 'gene'

  // --- filters (left panel) ---
  signs: [], // HPO sign indices the user is looking for
  minFreq: 1, // lowest frequency class that counts as a match (index into FREQ)
  levels: [1], // classification levels: 0 group, 1 disorder, 2 subtype
  onset: [],
  inheritance: [],
  prevClass: [], // -2 no record, -1 unknown, 0..5 classes
  need: { genes: false, signs: false, prev: false },

  // --- selections ---
  countBy: 'pref', // 'pref': once, under the preferential specialty | 'all': every membership
  specialties: [], // selected specialty indices
  specMode: 'any', // 'any': in that specialty | 'exact': in exactly this set of specialties
  focus: null, // focused disease index
  compare: [], // disease indices in the comparison set (besides the focus)
  gene: null, // focused gene index
});

export const state = defaults();
export let version = 0;

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
}

export function update(patch) {
  Object.assign(state, typeof patch === 'function' ? patch(state) : patch);
  version += 1;
  listeners.forEach((fn) => fn(state));
}

/** Reset the filters of the left panel. Selections are kept: the selection bar clears those. */
export function reset() {
  const d = defaults();
  update({ signs: d.signs, minFreq: d.minFreq, levels: d.levels, onset: d.onset, inheritance: d.inheritance, prevClass: d.prevClass, need: d.need });
}

export function toggled(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** How many filter controls differ from their defaults. */
export function activeFilterCount() {
  const s = state;
  return (
    s.signs.length +
    (s.minFreq === 1 ? 0 : 1) +
    (s.levels.length === 1 && s.levels[0] === 1 ? 0 : 1) +
    (s.onset.length ? 1 : 0) +
    (s.inheritance.length ? 1 : 0) +
    (s.prevClass.length ? 1 : 0) +
    Object.values(s.need).filter(Boolean).length
  );
}

// --- navigation helpers used by several views ---
export function openDisease(idx) {
  update((s) => ({ page: 'disease', focus: idx, compare: s.compare.filter((c) => c !== idx) }));
}

export function openGene(idx) {
  update({ page: 'gene', gene: idx });
}
