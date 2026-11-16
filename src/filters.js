// The filter panel on the left. It is the same on every page.
// Built once; sync() only refreshes the parts that depend on the state, so
// typing in the sign box is never interrupted by a redraw.
import { D, FREQ_SHORT, FREQ_RANGE, PREV_SHORT, searchSigns, getMatching, getBase } from './data.js';
import { state, update, reset, toggled, activeFilterCount } from './state.js';
import { h, autocomplete, fmt, FREQ_COLOR } from './util.js';

const EXAMPLE = ['Arachnodactyly', 'Ectopia lentis', 'Aortic root aneurysm'];

let refs = {};

export function buildFilters(root) {
  root.innerHTML = '';
  refs = { checks: [] };

  // ---- clinical signs ----
  const signInput = h('input', { type: 'search', placeholder: 'Add a clinical sign (HPO term)…', 'aria-label': 'Add a clinical sign' });
  refs.signChips = h('div', { class: 'chips' });
  refs.minFreq = h('select', {
    'aria-label': 'Minimum frequency',
    onchange: (e) => update({ minFreq: Number(e.target.value) }),
  }, [1, 2, 3, 4, 5].map((f) => h('option', { value: f }, `${FREQ_SHORT[f]} or more (≥ ${FREQ_RANGE[f].split('–')[0].replace('%', '')}%)`)));

  root.append(
    h('section', {},
      h('h3', {}, 'Clinical signs'),
      h('p', { class: 'hint' }, 'Find diseases by the signs a patient shows. A disease matches if it has at least one of the signs at the minimum frequency.'),
      signInput,
      refs.signChips,
      h('label', { class: 'field' }, 'Minimum frequency', refs.minFreq),
      h('button', {
        class: 'link',
        onclick: () => update({ signs: EXAMPLE.map((t) => D.signByTerm.get(t)).filter((x) => x !== undefined), page: 'overview' }),
      }, 'Try an example: Marfan-like signs'),
    ),
  );
  autocomplete(signInput, (q) =>
    searchSigns(q)
      .filter((s) => !state.signs.includes(s.idx))
      .map((s) => ({ label: s.term, sub: `${fmt(s.n)} diseases`, pick: () => update((st) => ({ signs: [...st.signs, s.idx] })) })),
  );

  // ---- checkbox groups ----
  const group = (title, key, options, open = false) => {
    const count = h('span', { class: 'badge' });
    const body = options.map(({ value, label }) => {
      const input = h('input', { type: 'checkbox', onchange: () => update((s) => ({ [key]: toggled(s[key], value) })) });
      refs.checks.push({ input, key, value });
      return h('label', { class: 'check' }, input, label);
    });
    refs[`${key}Count`] = count;
    return h('details', { open }, h('summary', {}, title, count), body);
  };

  root.append(
    group('Classification level', 'levels', ['Groups of disorders', 'Disorders', 'Subtypes'].map((label, value) => ({ value, label })), true),
    group('Age of onset', 'onset', D.vocab.onset.map((label, value) => ({ value, label }))),
    group('Inheritance', 'inheritance', D.vocab.inheritance.map((label, value) => ({ value, label }))),
    group('Prevalence class', 'prevClass', [
      ...PREV_SHORT.map((label, value) => ({ value, label })),
      { value: -1, label: 'Unknown (record without a class)' },
      { value: -2, label: 'No epidemiology record' },
    ]),
  );

  // ---- data completeness ----
  const need = (key, label) => {
    const input = h('input', { type: 'checkbox', onchange: () => update((s) => ({ need: { ...s.need, [key]: !s.need[key] } })) });
    refs.checks.push({ input, need: key });
    return h('label', { class: 'check' }, input, label);
  };
  root.append(
    h('details', {}, h('summary', {}, 'Data completeness'),
      h('p', { class: 'hint' }, 'Keep only diseases that have this kind of data.'),
      need('genes', 'Has gene associations'),
      need('signs', 'Has clinical signs'),
      need('prev', 'Has a prevalence class'),
    ),
  );

  refs.summary = h('p', { class: 'match-count' });
  refs.reset = h('button', { class: 'btn', onclick: reset }, 'Reset all filters');
  root.append(h('section', { class: 'filter-foot' }, refs.summary, refs.reset));

  syncFilters();
}

export function syncFilters() {
  // sign chips, each shaded with nothing but text: colour is kept for data
  refs.signChips.innerHTML = '';
  state.signs.forEach((s) => {
    refs.signChips.append(
      h('span', { class: 'chip' }, D.signs[s].term,
        h('button', { title: 'Remove', 'aria-label': `Remove ${D.signs[s].term}`, onclick: () => update((st) => ({ signs: st.signs.filter((x) => x !== s) })) }, '×')),
    );
  });
  refs.minFreq.value = state.minFreq;
  refs.minFreq.style.borderLeft = `8px solid ${FREQ_COLOR[state.minFreq]}`;

  for (const c of refs.checks) {
    c.input.checked = c.need ? state.need[c.need] : state[c.key].includes(c.value);
  }
  for (const key of ['levels', 'onset', 'inheritance', 'prevClass']) {
    const n = state[key].length;
    refs[`${key}Count`].textContent = key === 'levels' ? '' : n ? `${n} selected` : 'any';
  }

  const matching = getMatching().length;
  const base = getBase().length;
  refs.summary.innerHTML = `<strong>${fmt(matching)}</strong> of ${fmt(base)} entries match`;
  refs.reset.disabled = activeFilterCount() === 0 && !state.specialties.length;
}
