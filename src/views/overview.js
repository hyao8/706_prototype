// Overview page: specialties and their overlap (T1), prevalence by specialty
// (T6) and the candidate list ranked by clinical signs (T4).
import * as d3 from 'd3';
import { D, getMatching, getBase, inSpecialtySelection, prevLabel, FREQ_SHORT, FREQ_WEIGHT, LEVEL_SHORT } from '../data.js';
import { state, update, openDisease, openGene } from '../state.js';
import { h, fmt, pct, truncate, withTip, esc, FREQ_COLOR, prevColor } from '../util.js';

const ACCENT = '#d9480f';
const PREV_KEYS = [0, 1, 2, 3, 4, 5, -1, -2];
const N_INTERSECTIONS = 14;
let listLimit = 50;
let lastListKey = '';

export function renderOverview(root) {
  const matching = getMatching();
  root.append(specialtyPanel(matching), candidatePanel(matching));
}

// ------------------------------------------------- specialties + prevalence

function specialtyPanel(matching) {
  const byPref = state.countBy === 'pref';
  const specsOf = (d) => (byPref ? (d.pref >= 0 ? [d.pref] : []) : d.specs);
  const nSpec = D.specialties.length;

  const total = new Array(nSpec).fill(0); // at the chosen levels, before other filters
  const member = new Array(nSpec).fill(0); // any membership, to decide which rows exist
  for (const d of getBase()) {
    for (const s of specsOf(d)) total[s] += 1;
    for (const s of d.specs) member[s] += 1;
  }
  const count = new Array(nSpec).fill(0);
  const prev = D.specialties.map(() => Object.fromEntries(PREV_KEYS.map((k) => [k, 0])));
  const inter = new Map();
  for (const { d } of matching) {
    for (const s of specsOf(d)) {
      count[s] += 1;
      prev[s][d.pc] += 1;
    }
    if (d.specs.length) inter.set(d.specKey, (inter.get(d.specKey) || 0) + 1);
  }
  const rows = D.specialties.filter((s) => member[s.idx] > 0)
    .sort((a, b) => total[b.idx] - total[a.idx] || member[b.idx] - member[a.idx]);
  const rowOf = new Map(rows.map((s, i) => [s.idx, i]));
  const columns = [...inter].sort((a, b) => b[1] - a[1]).slice(0, N_INTERSECTIONS)
    .map(([key, n]) => ({ key, n, specs: key.split(',').map(Number) }));
  const filtered = matching.length < getBase().length;

  // ---- panel chrome ----
  const toggle = h('div', { class: 'seg', role: 'group', 'aria-label': 'How to count diseases' },
    h('button', { class: byPref ? 'on' : '', onclick: () => update({ countBy: 'pref', specialties: [] }) }, 'Once, under its main specialty'),
    h('button', { class: byPref ? '' : 'on', onclick: () => update({ countBy: 'all', specialties: [] }) }, 'In every specialty it belongs to'));
  const legend = h('div', { class: 'legend' },
    h('span', { class: 'legend-title' }, 'Prevalence class'),
    PREV_KEYS.map((k) => h('span', { class: 'legend-item' }, h('i', { style: `background:${prevColor(k)}` }), prevLabel(k))));
  const panel = h('section', { class: 'panel' },
    h('div', { class: 'panel-head' },
      h('div', {},
        h('h2', {}, 'Specialties, overlap and prevalence'),
        h('p', { class: 'sub' }, 'Each row is a medical specialty. Click a row to select it, or a column of dots to select diseases that belong to exactly that combination of specialties.')),
      h('label', { class: 'field inline' }, 'Count each disease', toggle)),
    legend);

  // ---- geometry ----
  const W = Math.max(1000, (document.querySelector('main')?.clientWidth || 1100) - 78);
  const rowH = 18;
  const top = 96;
  const labelW = 176;
  const numW = 46;
  const colW = 22;
  const upsetW = Math.max(columns.length, 1) * colW;
  const gap = 34;
  const flex = W - labelW - numW - upsetW - gap * 2 - numW - 8;
  const barW = Math.round(flex * 0.36);
  const prevW = flex - barW;
  const xBar = labelW;
  const xUpset = xBar + barW + numW + gap;
  const xPrev = xUpset + upsetW + gap;
  const H = top + rows.length * rowH + 8;

  const svg = d3.create('svg').attr('width', W).attr('height', H).attr('class', 'chart');
  const y = (i) => top + i * rowH;
  const selected = new Set(state.specialties);

  // section titles
  const title = (x, text, sub) => {
    svg.append('text').attr('x', x).attr('y', 14).attr('class', 'sec-title').text(text);
    svg.append('text').attr('x', x).attr('y', 29).attr('class', 'sec-sub').text(sub);
  };
  title(xBar, byPref ? 'Disorders per specialty' : 'Memberships per specialty', filtered ? 'dark = match the filters, light = all' : byPref ? 'each counted once' : 'a disease counts in each of its specialties');
  title(xUpset, 'Largest overlaps', 'diseases in exactly these specialties');
  title(xPrev, 'Prevalence classes', 'share of the diseases in each row (100%)');

  // row backgrounds (hover + selection + click target)
  const row = svg.append('g').selectAll('g').data(rows).join('g')
    .attr('transform', (s, i) => `translate(0,${y(i)})`)
    .attr('class', (s) => `row${selected.has(s.idx) ? ' selected' : ''}`)
    .style('cursor', 'pointer')
    .on('click', (e, s) => {
      const same = state.specMode === 'any' && state.specialties.length === 1 && state.specialties[0] === s.idx;
      update({ specialties: same ? [] : [s.idx], specMode: 'any' });
    });
  row.append('rect').attr('class', 'row-bg').attr('width', W).attr('height', rowH);
  row.append('text').attr('x', labelW - 8).attr('y', rowH / 2).attr('dy', '0.35em').attr('text-anchor', 'end')
    .attr('class', 'row-label').text((s) => truncate(s.label, 27));
  withTip(row.select('text'), (s) => `<b>${esc(s.name)}</b><br>${fmt(count[s.idx])} matching${filtered ? ` of ${fmt(total[s.idx])}` : ''}<br><span class="tip-note">${fmt(member[s.idx])} entries belong to this specialty in any way</span>`);

  // count bars
  const xs = d3.scaleLinear().domain([0, d3.max(rows, (s) => total[s.idx]) || 1]).range([0, barW]);
  row.append('rect').attr('x', xBar).attr('y', 3).attr('height', rowH - 6).attr('width', (s) => xs(total[s.idx])).attr('fill', '#e2e5ea');
  row.append('rect').attr('x', xBar).attr('y', 3).attr('height', rowH - 6).attr('width', (s) => xs(count[s.idx]))
    .attr('fill', (s) => (selected.has(s.idx) ? ACCENT : '#5b6b7d'));
  row.append('text').attr('x', (s) => xBar + xs(total[s.idx]) + 5).attr('y', rowH / 2).attr('dy', '0.35em').attr('class', 'num')
    .text((s) => (filtered ? `${fmt(count[s.idx])} / ${fmt(total[s.idx])}` : fmt(count[s.idx])));

  // overlap matrix (UpSet style)
  const maxInter = d3.max(columns, (c) => c.n) || 1;
  const hBar = d3.scaleLinear().domain([0, maxInter]).range([0, 40]);
  const exactKey = state.specMode === 'exact' ? [...state.specialties].sort((a, b) => a - b).join(',') : null;
  const grid = svg.append('g').attr('transform', `translate(${xUpset},0)`).attr('pointer-events', 'none');
  rows.forEach((s, i) => {
    columns.forEach((c, j) => {
      grid.append('circle').attr('cx', j * colW + colW / 2).attr('cy', y(i) + rowH / 2).attr('r', 3).attr('fill', '#dfe2e6');
    });
  });
  const col = svg.append('g').attr('transform', `translate(${xUpset},0)`).selectAll('g').data(columns).join('g')
    .attr('transform', (c, j) => `translate(${j * colW},0)`)
    .attr('class', (c) => `upset-col${c.key === exactKey ? ' selected' : ''}`)
    .style('cursor', 'pointer')
    .on('click', (e, c) => {
      e.stopPropagation();
      update({ specialties: c.key === exactKey ? [] : c.specs, specMode: 'exact' });
    });
  col.append('rect').attr('class', 'col-bg').attr('y', 34).attr('width', colW).attr('height', H - 34);
  col.append('rect').attr('x', 4).attr('width', colW - 8).attr('y', (c) => top - 8 - hBar(c.n)).attr('height', (c) => hBar(c.n)).attr('class', 'col-bar');
  col.append('text').attr('x', colW / 2).attr('y', (c) => top - 11 - hBar(c.n)).attr('text-anchor', 'middle').attr('class', 'num small')
    .text((c) => (c.n >= 1000 ? `${(c.n / 1000).toFixed(1)}k` : c.n));
  col.each(function (c) {
    const g = d3.select(this);
    const ys = c.specs.map((s) => y(rowOf.get(s)) + rowH / 2);
    if (ys.length > 1) g.append('line').attr('x1', colW / 2).attr('x2', colW / 2).attr('y1', d3.min(ys)).attr('y2', d3.max(ys)).attr('class', 'col-line');
    ys.forEach((cy) => g.append('circle').attr('cx', colW / 2).attr('cy', cy).attr('r', 4.5).attr('class', 'col-dot'));
  });
  withTip(col, (c) => `<b>${fmt(c.n)} matching entries</b> belong to exactly:<br>${c.specs.map((s) => esc(D.specialties[s].label)).join('<br>')}`);
  if (!columns.length) svg.append('text').attr('x', xUpset).attr('y', top + 12).attr('class', 'sec-sub').text('no data');

  // prevalence, one 100% bar per row
  const xp = d3.scaleLinear().domain([0, 1]).range([0, prevW]);
  const segs = svg.append('g').attr('transform', `translate(${xPrev},0)`);
  rows.forEach((s, i) => {
    const n = count[s.idx];
    let acc = 0;
    const parts = PREV_KEYS.map((k) => {
      const v = prev[s.idx][k];
      const part = { k, v, x0: acc / (n || 1), s, n };
      acc += v;
      return part;
    }).filter((p) => p.v > 0);
    const g = segs.append('g').attr('transform', `translate(0,${y(i)})`);
    withTip(
      g.selectAll('rect').data(parts).join('rect')
        .attr('x', (p) => xp(p.x0)).attr('y', 3).attr('height', rowH - 6)
        .attr('width', (p) => Math.max(0, xp(p.v / n) - 0.5))
        .attr('fill', (p) => prevColor(p.k))
        .attr('stroke', (p) => (p.k === -2 ? '#cfcfcf' : 'none')),
      (p) => `<b>${esc(p.s.label)}</b><br>${prevLabel(p.k)}: <b>${fmt(p.v)}</b> of ${fmt(p.n)} (${pct(p.v / p.n)})`,
    );
    g.append('text').attr('x', prevW + 6).attr('y', rowH / 2).attr('dy', '0.35em').attr('class', 'num').text(n ? `n=${fmt(n)}` : '–');
  });
  [0, 0.25, 0.5, 0.75, 1].forEach((t) => {
    segs.append('text').attr('x', xp(t)).attr('y', top - 6).attr('text-anchor', t === 0 ? 'start' : t === 1 ? 'end' : 'middle').attr('class', 'num small').text(`${t * 100}%`);
  });

  panel.append(h('div', { class: 'scroll-x' }, svg.node()));
  panel.append(h('p', { class: 'note' },
    `${pct(D.meta.counts.multiSpecialtyDisorders / D.meta.counts.byLevel[1])} of disorders belong to more than one specialty, so memberships do not add up to the total. `,
    'Grey prevalence segments are missing data (unknown class, or no epidemiology record), never zero.'));
  return panel;
}

// ----------------------------------------------------------- candidate list

function candidatePanel(matching) {
  const useSigns = state.signs.length > 0;
  const list = matching.filter((m) => inSpecialtySelection(m.d));
  const key = `${state.signs}|${state.minFreq}|${state.specialties}|${state.specMode}`;
  if (key !== lastListKey) listLimit = 50;
  lastListKey = key;

  const inSet = (idx) => state.focus === idx || state.compare.includes(idx);
  const nSet = state.compare.length + (state.focus !== null ? 1 : 0);
  const toggleSet = (idx) => update((s) => {
    if (s.focus === idx) return { focus: s.compare[0] ?? null, compare: s.compare.slice(1) };
    if (s.compare.includes(idx)) return { compare: s.compare.filter((c) => c !== idx) };
    return s.focus === null ? { focus: idx } : { compare: [...s.compare, idx] };
  });

  const scope = state.specialties.length
    ? ` in ${state.specMode === 'exact' ? 'exactly ' : ''}${state.specialties.map((s) => D.specialties[s].label).join(' + ')}`
    : '';
  const panel = h('section', { class: 'panel' },
    h('div', { class: 'panel-head' },
      h('div', {},
        h('h2', {}, useSigns ? 'Candidate diseases' : 'Diseases', h('span', { class: 'count' }, `${fmt(list.length)}${scope}`)),
        h('p', { class: 'sub' }, useSigns
          ? 'Ranked by score = sum of the frequency weights of the matched signs ÷ number of signs asked for. Each square is one of your signs, shaded by how often the disease shows it.'
          : 'Add clinical signs in the filter panel to rank diseases. Tick diseases to compare them, or click a name to open its profile.')),
      h('button', { class: 'btn primary', disabled: nSet < 1, onclick: () => update({ page: 'disease' }) }, nSet > 1 ? `Compare ${nSet} diseases →` : nSet === 1 ? 'Open selected disease →' : 'Tick diseases to compare')));

  if (!list.length) {
    panel.append(h('p', { class: 'empty' }, 'No disease matches the current filters. Remove a sign, lower the minimum frequency, or reset the filters.'));
    return panel;
  }

  const head = h('tr', {},
    h('th', { class: 'c-check' }, ''),
    useSigns ? h('th', { class: 'c-rank' }, '#') : null,
    h('th', {}, 'Disease'),
    useSigns ? h('th', {}, 'Score', h('span', { class: 'th-note' }, ' (0–1)')) : null,
    useSigns ? h('th', {}, 'Your signs', h('span', { class: 'th-note' }, ` (${state.signs.length})`)) : null,
    h('th', {}, 'Main specialty'),
    h('th', {}, 'Genes'),
    h('th', {}, 'Prevalence'),
    useSigns ? null : h('th', { class: 'c-num' }, 'Signs'));

  const body = list.slice(0, listLimit).map((m, i) => {
    const d = m.d;
    const squares = useSigns
      ? h('td', { class: 'squares' }, m.hits.map((f, k) => {
        const term = D.signs[state.signs[k]].term;
        const below = f >= 0 && f < state.minFreq;
        return h('i', {
          class: f < 0 ? 'none' : f === 0 ? 'excluded' : below ? 'below' : '',
          style: f > 0 ? `background:${FREQ_COLOR[f]}` : '',
          title: `${term}: ${f < 0 ? 'not annotated for this disease' : FREQ_SHORT[f]}${below ? ' (below your minimum frequency)' : ''}`,
        }, f === 0 ? '×' : '');
      }))
      : null;
    const score = useSigns
      ? h('td', { class: 'score', title: m.hits.map((f, k) => `${D.signs[state.signs[k]].term}: ${f >= state.minFreq ? FREQ_WEIGHT[f] : 0}`).join(' + ') + ` = ${(m.score * state.signs.length).toFixed(2)}, ÷ ${state.signs.length}` },
        h('span', { class: 'score-bar' }, h('i', { style: `width:${Math.round(m.score * 100)}%` })),
        h('span', { class: 'score-num' }, m.score.toFixed(2)),
        h('span', { class: 'muted' }, ` ${m.matched}/${state.signs.length}`))
      : null;
    return h('tr', { class: inSet(d.idx) ? 'checked' : '' },
      h('td', { class: 'c-check' }, h('input', { type: 'checkbox', checked: inSet(d.idx), 'aria-label': `Compare ${d.name}`, onchange: () => toggleSet(d.idx) })),
      useSigns ? h('td', { class: 'c-rank' }, i + 1) : null,
      h('td', {}, h('button', { class: 'link name', title: d.name, onclick: () => openDisease(d.idx) }, truncate(d.name, 42)),
        d.level !== 1 ? h('span', { class: 'tag' }, LEVEL_SHORT[d.level]) : null),
      score, squares,
      h('td', { class: 'muted' }, d.pref >= 0 ? truncate(D.specialties[d.pref].label, 24) : '–'),
      h('td', {}, d.gs.length
        ? [d.gs.slice(0, 3).map((g) => h('button', { class: 'link gene', onclick: () => openGene(g) }, D.genes[g].symbol)), d.gs.length > 3 ? h('span', { class: 'muted' }, ` +${d.gs.length - 3}`) : null]
        : h('span', { class: 'muted' }, '–')),
      h('td', {}, h('span', { class: 'prev-dot', style: `background:${prevColor(d.pc)}` }), h('span', { class: d.pc < 0 ? 'muted' : '' }, prevLabel(d.pc))),
      useSigns ? null : h('td', { class: 'c-num' }, d.signs.size || h('span', { class: 'muted' }, '–')));
  });

  panel.append(h('div', { class: 'scroll-x' }, h('table', { class: 'list' }, h('thead', {}, head), h('tbody', {}, body))));
  if (list.length > listLimit) {
    panel.append(h('button', { class: 'btn', onclick: () => { listLimit += 100; update({}); } }, `Show more (${fmt(list.length - listLimit)} not shown)`));
  }
  if (useSigns) {
    panel.append(h('p', { class: 'note' }, `Frequency weights: ${[5, 4, 3, 2, 1].map((f) => `${FREQ_SHORT[f]} ${FREQ_WEIGHT[f]}`).join(' · ')}. Signs below your minimum frequency, and excluded signs (×), count as 0.`));
  }
  return panel;
}
