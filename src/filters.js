// The filter panel on the left. It is the same on every page.
// Built once; sync() only refreshes the parts that depend on the state, so
// typing in the sign box is never interrupted by a redraw.
import { D, FREQ_SHORT, FREQ_RANGE, PREV_SHORT, searchSigns, getMatching, getBase } from './data.js';
import { state, update, reset, toggled, activeFilterCount } from './state.js';
import { h, autocomplete, fmt, icon, FREQ_COLOR, prevColor } from './util.js';

const EXAMPLE = ['Arachnodactyly', 'Ectopia lentis', 'Aortic root aneurysm'];

let refs = {};

export function buildFilters(root) {
  root.innerHTML = '';
  refs = { checks: [] };

  // ---- head: title, number of active filters, reset ----
  refs.count = h('span', { class: 'pill' });
  refs.reset = h('button', { class: 'link small reset', onclick: reset, title: 'Clear every filter' }, icon('reset', 13), 'Reset');
  root.append(h('div', { class: 'filters-head' }, icon('filter', 16), h('h2', {}, 'Filters'), refs.count, h('span', { class: 'spacer' }), refs.reset));

  // ---- clinical signs ----
  const signInput = h('input', { type: 'search', placeholder: 'Add a clinical sign…', 'aria-label': 'Add a clinical sign (HPO term)' });
  refs.signChips = h('div', { class: 'chips' });
  refs.minFreqSwatch = h('i', { class: 'swatch' });
  refs.minFreq = h('select', {
    'aria-label': 'Minimum frequency',
    onchange: (e) => update({ minFreq: Number(e.target.value) }),
  }, [1, 2, 3, 4, 5].map((f) => h('option', { value: f }, `${FREQ_SHORT[f]} or more (≥ ${FREQ_RANGE[f].split('–')[0].replace('%', '')}%)`)));

  root.append(
    h('section', { class: 'fcard' },
      h('h3', {}, 'Clinical signs'),
      h('p', { class: 'hint' }, 'Find diseases by the signs a patient shows. A disease matches if it has at least one of the signs at the minimum frequency.'),
      signInput,
      refs.signChips,
      h('label', { class: 'field' }, 'Minimum frequency', h('span', { class: 'select-wrap' }, refs.minFreqSwatch, refs.minFreq)),
      h('button', {
        class: 'example',
        onclick: () => update({ signs: EXAMPLE.map((t) => D.signByTerm.get(t)).filter((x) => x !== undefined), page: 'overview' }),
      }, icon('spark', 14), 'Try an example: Marfan-like signs'),
    ),
  );
  autocomplete(signInput, (q) =>
    searchSigns(q)
      .filter((s) => !state.signs.includes(s.idx))
      .map((s) => ({ label: s.term, sub: `${fmt(s.n)} diseases`, pick: () => update((st) => ({ signs: [...st.signs, s.idx] })) })),
  { icon: 'plus' });

  // ---- checkbox groups ----
  const group = (title, key, options, open = false) => {
    const count = h('span', { class: 'badge' });
    const body = options.map(({ value, label, color }) => {
      const input = h('input', { type: 'checkbox', onchange: () => update((s) => ({ [key]: toggled(s[key], value) })) });
      refs.checks.push({ input, key, value });
      return h('label', { class: 'check' }, input, color ? h('i', { class: 'swatch', style: `background:${color}` }) : null, label);
    });
    refs[`${key}Count`] = count;
    return h('details', { open }, h('summary', {}, h('span', {}, title), count), h('div', { class: 'details-body' }, body));
  };

  root.append(
    group('Classification level', 'levels', ['Groups of disorders', 'Disorders', 'Subtypes'].map((label, value) => ({ value, label })), true),
    group('Age of onset', 'onset', D.vocab.onset.map((label, value) => ({ value, label }))),
    group('Inheritance', 'inheritance', D.vocab.inheritance.map((label, value) => ({ value, label }))),
    group('Prevalence class', 'prevClass', [
      ...PREV_SHORT.map((label, value) => ({ value, label, color: prevColor(value) })),
      { value: -1, label: 'Unknown (record without a class)', color: prevColor(-1) },
      { value: -2, label: 'No epidemiology record', color: prevColor(-2) },
    ]),
  );

  // ---- data completeness ----
  const need = (key, label) => {
    const input = h('input', { type: 'checkbox', onchange: () => update((s) => ({ need: { ...s.need, [key]: !s.need[key] } })) });
    refs.checks.push({ input, need: key });
    return h('label', { class: 'check' }, input, label);
  };
  refs.needCount = h('span', { class: 'badge' });
  root.append(
    h('details', {}, h('summary', {}, h('span', {}, 'Data completeness'), refs.needCount),
      h('div', { class: 'details-body' },
        h('p', { class: 'hint' }, 'Keep only diseases that have this kind of data.'),
        need('genes', 'Has gene associations'),
        need('signs', 'Has clinical signs'),
        need('prev', 'Has a prevalence class'))),
  );

  refs.summary = h('p', { class: 'match-count' });
  refs.meter = h('i', {});
  root.append(h('section', { class: 'filter-foot' }, refs.summary, h('div', { class: 'meter' }, refs.meter)));

  syncFilters();
}

export function syncFilters() {
  // sign chips carry text only: colour is kept for data
  refs.signChips.innerHTML = '';
  state.signs.forEach((s, i) => {
    refs.signChips.append(
      h('span', { class: 'chip' }, h('b', { class: 'chip-n' }, i + 1), h('span', { class: 'chip-text', title: D.signs[s].term }, D.signs[s].term),
        h('button', { class: 'chip-x', title: 'Remove', 'aria-label': `Remove ${D.signs[s].term}`, onclick: () => update((st) => ({ signs: st.signs.filter((x) => x !== s) })) }, icon('x', 12))),
    );
  });
  refs.minFreq.value = state.minFreq;
  refs.minFreqSwatch.style.background = FREQ_COLOR[state.minFreq];

  for (const c of refs.checks) {
    c.input.checked = c.need ? state.need[c.need] : state[c.key].includes(c.value);
  }
  for (const key of ['levels', 'onset', 'inheritance', 'prevClass']) {
    const n = state[key].length;
    const el = refs[`${key}Count`];
    el.textContent = key === 'levels' ? `${n} of 3` : n ? `${n} selected` : 'any';
    el.classList.toggle('on', key === 'levels' ? !(n === 1 && state.levels[0] === 1) : n > 0);
  }
  const needed = Object.values(state.need).filter(Boolean).length;
  refs.needCount.textContent = needed ? `${needed} required` : 'any';
  refs.needCount.classList.toggle('on', needed > 0);

  const matching = getMatching().length;
  const base = getBase().length;
  refs.summary.innerHTML = `<strong>${fmt(matching)}</strong> of ${fmt(base)} entries match`;
  refs.meter.style.width = `${base ? (matching / base) * 100 : 0}%`;

  const active = activeFilterCount();
  refs.count.textContent = active ? `${active} active` : 'none active';
  refs.count.classList.toggle('on', active > 0);
  refs.reset.disabled = active === 0;
}
