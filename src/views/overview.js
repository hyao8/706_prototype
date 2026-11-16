// Overview page: key figures, specialties and their overlap (T1), prevalence
// by specialty (T6) and the candidate list ranked by clinical signs (T4).
import * as d3 from 'd3';
import { D, getMatching, getBase, inSpecialtySelection, prevLabel, FREQ_SHORT, FREQ_RANGE, FREQ_WEIGHT, LEVEL_SHORT } from '../data.js';
import { state, update, openDisease, openGene } from '../state.js';
import { h, fmt, pct, truncate, withTip, esc, icon, hbar, vbar, chartWidth, tipKey, FREQ_COLOR, prevColor, ACCENT, MARK, MARK_SOFT } from '../util.js';

const PREV_KEYS = [0, 1, 2, 3, 4, 5, -1, -2];
const N_INTERSECTIONS = 14;
const N_INTERSECTIONS_NARROW = 10; // on a narrow window, leave room for the prevalence bars
let listLimit = 50;
let lastListKey = '';

export function renderOverview(root) {
  const matching = getMatching();
  const list = matching.filter((m) => inSpecialtySelection(m.d));
  root.append(...[statTiles(list), specialtyPanel(matching), candidatePanel(list), compareTray()].filter(Boolean));
}

// -------------------------------------------------------------- key figures

/** Five figures about the diseases currently in view (filters + specialty selection). */
function statTiles(list) {
  const n = list.length;
  const base = getBase().length;
  const noun = state.levels.length === 1 && state.levels[0] === 1 ? 'disorders' : 'entries';
  const count = (test) => list.reduce((k, m) => k + (test(m.d) ? 1 : 0), 0);
  const tile = (iconName, label, value, sub, frac, title) => h('div', { class: 'stat', title },
    h('div', { class: 'stat-label' }, icon(iconName, 14), label),
    h('div', { class: 'stat-value' }, value),
    h('div', { class: 'stat-sub' }, sub),
    h('div', { class: 'meter' }, h('i', { style: `width:${Math.round((frac || 0) * 1000) / 10}%` })));
  const share = (iconName, label, k, title) =>
    tile(iconName, label, n ? pct(k / n) : '–', n ? `${fmt(k)} of ${fmt(n)}` : 'nothing in view', n ? k / n : 0, title);

  return h('div', { class: 'stats' },
    tile('list', `${noun[0].toUpperCase()}${noun.slice(1)} in view`, fmt(n),
      `of ${fmt(base)} ${noun}${state.specialties.length ? ' · specialty selected' : ''}`, base ? n / base : 0,
      'Entries that pass the filters and the specialty selection. The figures on the right describe this set.'),
    share('people', 'Prevalence known', count((d) => d.pc >= 0), 'Share with a prevalence class. The rest is unknown or has no epidemiology record.'),
    share('gene', 'With a linked gene', count((d) => d.gs.length > 0), 'Share with at least one gene association.'),
    share('signs', 'With clinical signs', count((d) => d.signs.size > 0), 'Share with at least one annotated clinical sign (HPO term).'),
    share('layers', 'In several specialties', count((d) => d.specs.length > 1), 'Share that belongs to more than one medical specialty.'));
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
  const W = chartWidth(880);
  const columns = [...inter].sort((a, b) => b[1] - a[1]).slice(0, W < 1000 ? N_INTERSECTIONS_NARROW : N_INTERSECTIONS)
    .map(([key, n]) => ({ key, n, specs: key.split(',').map(Number) }));
  const filtered = matching.length < getBase().length;

  // ---- panel chrome ----
  const toggle = h('div', { class: 'seg', role: 'group', 'aria-label': 'How to count diseases' },
    h('button', { class: byPref ? 'on' : '', 'aria-pressed': String(byPref), onclick: () => update({ countBy: 'pref', specialties: [] }) }, 'Once, under its main specialty'),
    h('button', { class: byPref ? '' : 'on', 'aria-pressed': String(!byPref), onclick: () => update({ countBy: 'all', specialties: [] }) }, 'In every specialty it belongs to'));
  const key = (k) => h('span', { class: 'legend-item' }, h('i', { style: `background:${prevColor(k)}` }), prevLabel(k));
  const legend = h('div', { class: 'legend' },
    h('span', { class: 'legend-title' }, 'Prevalence class'),
    h('span', { class: 'legend-ends' }, 'rarer'), PREV_KEYS.filter((k) => k >= 0).map(key), h('span', { class: 'legend-ends' }, 'more common'),
    h('span', { class: 'legend-sep' }),
    h('span', { class: 'legend-title' }, 'Missing data'), key(-1), key(-2));
  const panel = h('section', { class: 'panel' },
    h('div', { class: 'panel-head' },
      h('div', {},
        h('h2', {}, icon('layers', 17), 'Specialties, overlap and prevalence'),
        h('p', { class: 'sub' }, 'Each row is a medical specialty. Click a row to select it, or a column of dots to select the diseases that belong to exactly that combination of specialties.')),
      h('label', { class: 'field inline' }, 'Count each disease', toggle)),
    legend);

  // ---- geometry ----
  const rowH = 22;
  const barH = 12;
  const barY = (rowH - barH) / 2;
  const top = 104;
  const labelW = 198;
  const numW = filtered ? 88 : 46;
  const colW = 20;
  const upsetW = Math.max(columns.length, 1) * colW;
  const gap = 28;
  const tailW = 62;
  const flex = W - labelW - numW - upsetW - gap * 2 - tailW;
  const barW = Math.round(flex * 0.38);
  const prevW = flex - barW;
  const xBar = labelW;
  const xUpset = xBar + barW + numW + gap;
  const xPrev = xUpset + upsetW + gap;
  const H = top + rows.length * rowH + 10;

  const svg = d3.create('svg').attr('width', W).attr('height', H).attr('class', 'chart')
    .attr('role', 'group').attr('aria-label', 'Disorders per specialty, largest overlaps between specialties, and prevalence classes per specialty');
  svg.append('defs').append('clipPath').attr('id', 'prev-clip')
    .append('rect').attr('y', barY).attr('width', prevW).attr('height', barH).attr('rx', 3);
  const y = (i) => top + i * rowH;
  const selected = new Set(state.specialties);

  // section titles
  const title = (x, text, sub) => {
    svg.append('text').attr('x', x).attr('y', 14).attr('class', 'sec-title').text(text);
    svg.append('text').attr('x', x).attr('y', 30).attr('class', 'sec-sub').text(sub);
  };
  title(xBar, byPref ? 'Disorders per specialty' : 'Memberships per specialty', filtered ? 'dark = matching, light = all' : byPref ? 'each counted once' : 'one per membership');
  title(xUpset, 'Largest overlaps', 'in exactly these specialties');
  title(xPrev, 'Prevalence classes', 'share of each row (100%)');

  // rows: hover band, selection and click target
  const pick = (s) => {
    const same = state.specMode === 'any' && state.specialties.length === 1 && state.specialties[0] === s.idx;
    update({ specialties: same ? [] : [s.idx], specMode: 'any' });
  };
  const row = svg.append('g').selectAll('g').data(rows).join('g')
    .attr('transform', (s, i) => `translate(0,${y(i)})`)
    .attr('class', (s) => `row${selected.has(s.idx) ? ' selected' : ''}`)
    .attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', (s) => `${s.label}: ${fmt(count[s.idx])} entries. Select this specialty.`)
    .on('click', (e, s) => pick(s))
    .on('keydown', (e, s) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pick(s);
      }
    });
  row.append('rect').attr('class', 'row-bg').attr('x', 2).attr('width', W - 4).attr('height', rowH).attr('rx', 6);
  row.append('text').attr('x', labelW - 12).attr('y', rowH / 2).attr('dy', '0.35em').attr('text-anchor', 'end')
    .attr('class', 'row-label').text((s) => truncate(s.label, 30));
  withTip(row.select('text'), (s) => `<b>${esc(s.name)}</b><br><b>${fmt(count[s.idx])}</b> matching${filtered ? ` of ${fmt(total[s.idx])}` : ''}<br><span class="tip-note">${fmt(member[s.idx])} entries belong to this specialty in any way · click to select</span>`);

  // count bars: light = all, dark = matching the filters
  const xs = d3.scaleLinear().domain([0, d3.max(rows, (s) => total[s.idx]) || 1]).range([0, barW]);
  row.append('path').attr('d', (s) => hbar(xBar, barY, xs(total[s.idx]), barH)).attr('fill', MARK_SOFT);
  row.append('path').attr('class', 'bar').attr('d', (s) => hbar(xBar, barY, xs(count[s.idx]), barH))
    .attr('fill', (s) => (selected.has(s.idx) ? ACCENT : MARK));
  row.append('text').attr('x', (s) => xBar + xs(total[s.idx]) + 6).attr('y', rowH / 2).attr('dy', '0.35em').attr('class', 'num')
    .text((s) => (filtered ? `${fmt(count[s.idx])} / ${fmt(total[s.idx])}` : fmt(count[s.idx])));

  // overlap matrix (UpSet style)
  const maxInter = d3.max(columns, (c) => c.n) || 1;
  const hBar = d3.scaleLinear().domain([0, maxInter]).range([0, 42]);
  const baseY = top - 12;
  const exactKey = state.specMode === 'exact' ? [...state.specialties].sort((a, b) => a - b).join(',') : null;
  const grid = svg.append('g').attr('transform', `translate(${xUpset},0)`).attr('pointer-events', 'none');
  rows.forEach((s, i) => {
    columns.forEach((c, j) => {
      grid.append('circle').attr('cx', j * colW + colW / 2).attr('cy', y(i) + rowH / 2).attr('r', 2.5).attr('class', 'grid-dot');
    });
  });
  const pickCol = (c) => update({ specialties: c.key === exactKey ? [] : c.specs, specMode: 'exact' });
  const col = svg.append('g').attr('transform', `translate(${xUpset},0)`).selectAll('g').data(columns).join('g')
    .attr('transform', (c, j) => `translate(${j * colW},0)`)
    .attr('class', (c) => `upset-col${c.key === exactKey ? ' selected' : ''}`)
    .attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', (c) => `${fmt(c.n)} entries in exactly ${c.specs.map((s) => D.specialties[s].label).join(' and ')}. Select this combination.`)
    .on('click', (e, c) => {
      e.stopPropagation();
      pickCol(c);
    })
    .on('keydown', (e, c) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pickCol(c);
      }
    });
  col.append('rect').attr('class', 'col-bg').attr('y', 38).attr('width', colW).attr('height', H - 40).attr('rx', 6);
  col.append('path').attr('class', 'col-bar').attr('d', (c) => {
    const hh = Math.max(1.5, hBar(c.n));
    return vbar(4, baseY - hh, colW - 8, hh);
  });
  col.append('text').attr('x', colW / 2).attr('y', (c) => baseY - Math.max(1.5, hBar(c.n)) - 4).attr('text-anchor', 'middle').attr('class', 'num small')
    .text((c) => (c.n >= 1000 ? `${(c.n / 1000).toFixed(1)}k` : c.n));
  col.each(function (c) {
    const g = d3.select(this);
    const ys = c.specs.map((s) => y(rowOf.get(s)) + rowH / 2);
    if (ys.length > 1) g.append('line').attr('x1', colW / 2).attr('x2', colW / 2).attr('y1', d3.min(ys)).attr('y2', d3.max(ys)).attr('class', 'col-line');
    ys.forEach((cy) => g.append('circle').attr('cx', colW / 2).attr('cy', cy).attr('r', 5).attr('class', 'col-dot'));
  });
  withTip(col, (c) => `<b>${fmt(c.n)}</b> matching entries belong to exactly<br>${c.specs.map((s) => esc(D.specialties[s].label)).join(' + ')}<br><span class="tip-note">click to select this combination</span>`);
  if (!columns.length) svg.append('text').attr('x', xUpset).attr('y', top + 14).attr('class', 'sec-sub').text('no data');

  // prevalence: one 100% bar per row
  const xp = d3.scaleLinear().domain([0, 1]).range([0, prevW]);
  const segs = svg.append('g').attr('transform', `translate(${xPrev},0)`);
  (prevW < 190 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]).forEach((t) => {
    segs.append('line').attr('class', 'gridline').attr('x1', xp(t)).attr('x2', xp(t)).attr('y1', top - 4).attr('y2', H - 8);
    segs.append('text').attr('x', xp(t)).attr('y', top - 10).attr('text-anchor', t === 0 ? 'start' : t === 1 ? 'end' : 'middle').attr('class', 'num small').text(`${t * 100}%`);
  });
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
      g.append('g').attr('clip-path', 'url(#prev-clip)').selectAll('rect').data(parts).join('rect')
        .attr('class', 'seg-rect')
        .attr('x', (p) => xp(p.x0)).attr('y', barY).attr('height', barH)
        // a 2 px gap in the surface colour separates the segments
        .attr('width', (p, j) => (j === parts.length - 1 ? prevW - xp(p.x0) : Math.max(1, xp(p.v / n) - 2)))
        .attr('fill', (p) => prevColor(p.k)),
      (p) => `<b>${esc(p.s.label)}</b><br>${tipKey(prevColor(p.k))}${prevLabel(p.k)}: <b>${fmt(p.v)}</b> of ${fmt(p.n)} (${pct(p.v / p.n)})`,
    );
    g.append('text').attr('x', prevW + 8).attr('y', rowH / 2).attr('dy', '0.35em').attr('class', 'num').text(n ? `n=${fmt(n)}` : '–');
  });

  panel.append(h('div', { class: 'scroll-x' }, svg.node()));
  panel.append(h('p', { class: 'note' }, icon('info', 14),
    h('span', {}, `${pct(D.meta.counts.multiSpecialtyDisorders / D.meta.counts.byLevel[1])} of disorders belong to more than one specialty, so memberships do not add up to the total. `,
      'Grey prevalence segments are missing data (unknown class, or no epidemiology record), never zero.')));
  return panel;
}

// ----------------------------------------------------------- candidate list

const inSet = (idx) => state.focus === idx || state.compare.includes(idx);
const setSize = () => state.compare.length + (state.focus !== null ? 1 : 0);
const toggleSet = (idx) => update((s) => {
  if (s.focus === idx) return { focus: s.compare[0] ?? null, compare: s.compare.slice(1) };
  if (s.compare.includes(idx)) return { compare: s.compare.filter((c) => c !== idx) };
  return s.focus === null ? { focus: idx } : { compare: [...s.compare, idx] };
});

function candidatePanel(list) {
  const useSigns = state.signs.length > 0;
  const key = `${state.signs}|${state.minFreq}|${state.specialties}|${state.specMode}`;
  if (key !== lastListKey) listLimit = 50;
  lastListKey = key;

  const scope = state.specialties.length
    ? ` in ${state.specMode === 'exact' ? 'exactly ' : ''}${state.specialties.map((s) => D.specialties[s].label).join(' + ')}`
    : '';
  const panel = h('section', { class: 'panel' },
    h('div', { class: 'panel-head' },
      h('div', {},
        h('h2', {}, icon('list', 17), useSigns ? 'Candidate diseases' : 'Diseases', h('span', { class: 'count' }, `${fmt(list.length)}${scope}`)),
        h('p', { class: 'sub' }, useSigns
          ? 'Ranked by score = sum of the frequency weights of the matched signs ÷ number of signs asked for. Each square is one of your signs, shaded by how often the disease shows it.'
          : 'Add clinical signs in the filter panel to rank diseases. Tick diseases to compare them, or click a name to open its profile.')),
      setSize() ? null : h('span', { class: 'head-hint' }, icon('compare', 15), 'Tick diseases to compare them')));

  if (!list.length) {
    panel.append(h('p', { class: 'empty' }, 'No disease matches the current filters. Remove a sign, lower the minimum frequency, or reset the filters.'));
    return panel;
  }

  if (useSigns) {
    panel.append(h('div', { class: 'legend' },
      h('span', { class: 'legend-title' }, 'Your signs'),
      state.signs.map((s, k) => h('span', { class: 'legend-item sign-key' }, h('b', {}, k + 1), D.signs[s].term)),
      h('span', { class: 'legend-sep' }),
      h('span', { class: 'legend-title' }, 'Frequency'),
      [1, 2, 3, 4, 5].map((f) => h('span', { class: 'legend-item', title: FREQ_RANGE[f] }, h('i', { class: 'box', style: `background:${FREQ_COLOR[f]}` }), FREQ_SHORT[f])),
      h('span', { class: 'legend-item' }, h('i', { class: 'box none' }), 'Not annotated')));
  }

  const head = h('tr', {},
    h('th', { class: 'c-check' }, ''),
    useSigns ? h('th', { class: 'c-rank' }, '#') : null,
    h('th', { class: 'c-name' }, 'Disease'),
    useSigns ? h('th', {}, 'Score', h('span', { class: 'th-note' }, ' (0–1)')) : null,
    useSigns ? h('th', {}, 'Your signs', h('span', { class: 'th-note' }, state.signs.length > 1 ? ` (1–${state.signs.length})` : '')) : null,
    h('th', { class: 'c-spec' }, 'Main specialty'),
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
          title: `${k + 1}. ${term}: ${f < 0 ? 'not annotated for this disease' : FREQ_SHORT[f]}${below ? ' (below your minimum frequency)' : ''}`,
        }, f === 0 ? '×' : '');
      }))
      : null;
    const score = useSigns
      ? h('td', { class: 'score', title: `${m.hits.map((f, k) => `${D.signs[state.signs[k]].term}: ${f >= state.minFreq ? FREQ_WEIGHT[f] : 0}`).join(' + ')} = ${(m.score * state.signs.length).toFixed(2)}, ÷ ${state.signs.length}` },
        h('span', { class: 'score-bar' }, h('i', { style: `width:${Math.round(m.score * 100)}%` })),
        h('span', { class: 'score-num' }, m.score.toFixed(2)),
        h('span', { class: 'muted' }, ` ${m.matched}/${state.signs.length}`))
      : null;
    return h('tr', { class: inSet(d.idx) ? 'checked' : '' },
      h('td', { class: 'c-check' }, h('input', { type: 'checkbox', checked: inSet(d.idx), 'aria-label': `Compare ${d.name}`, onchange: () => toggleSet(d.idx) })),
      useSigns ? h('td', { class: 'c-rank' }, i + 1) : null,
      h('td', { class: 'c-name' }, h('div', { class: 'name-cell' },
        h('button', { class: 'link name', title: `${d.name} — open the profile`, onclick: () => openDisease(d.idx) }, d.name),
        d.level !== 1 ? h('span', { class: 'tag' }, LEVEL_SHORT[d.level]) : null)),
      score, squares,
      h('td', { class: 'c-spec muted' }, d.pref >= 0 ? truncate(D.specialties[d.pref].label, 24) : '–'),
      h('td', {}, d.gs.length
        ? [d.gs.slice(0, 3).map((g) => h('button', { class: 'link gene', title: `${D.genes[g].name} — open on the Gene page`, onclick: () => openGene(g) }, D.genes[g].symbol)), d.gs.length > 3 ? h('span', { class: 'muted' }, ` +${d.gs.length - 3}`) : null]
        : h('span', { class: 'muted' }, '–')),
      h('td', {}, h('span', { class: 'prev-dot', style: `background:${prevColor(d.pc)}` }), h('span', { class: d.pc < 0 ? 'muted' : '' }, prevLabel(d.pc))),
      useSigns ? null : h('td', { class: 'c-num' }, d.signs.size || h('span', { class: 'muted' }, '–')));
  });

  panel.append(h('div', { class: 'scroll-x' }, h('table', { class: `list${useSigns ? ' ranked' : ''}` }, h('thead', {}, head), h('tbody', {}, body))));
  if (list.length > listLimit) {
    panel.append(h('button', { class: 'btn more', onclick: () => { listLimit += 100; update({}); } }, `Show more (${fmt(list.length - listLimit)} not shown)`));
  }
  if (useSigns) {
    panel.append(h('p', { class: 'note' }, icon('info', 14),
      h('span', {}, `Frequency weights: ${[5, 4, 3, 2, 1].map((f) => `${FREQ_SHORT[f]} ${FREQ_WEIGHT[f]}`).join(' · ')}. Signs below your minimum frequency (dashed) and excluded signs (×) count as 0.`)));
  }
  return panel;
}

/** A bar that stays at the bottom of the window while diseases are ticked. */
function compareTray() {
  const n = setSize();
  if (!n) return null;
  const set = [state.focus, ...state.compare].filter((i) => i !== null).map((i) => D.diseases[i]);
  return h('div', { class: 'tray', role: 'region', 'aria-label': 'Diseases selected for comparison' },
    h('span', { class: 'tray-title' }, icon('compare', 16), `${n} selected`),
    h('span', { class: 'tray-items' },
      set.slice(0, 4).map((d) => h('span', { class: 'chip dark' }, h('span', { class: 'chip-text', title: d.name }, truncate(d.name, 30)),
        h('button', { class: 'chip-x', title: 'Remove', 'aria-label': `Remove ${d.name}`, onclick: () => toggleSet(d.idx) }, icon('x', 12)))),
      set.length > 4 ? h('span', { class: 'tray-more' }, `+${set.length - 4} more`) : null),
    h('span', { class: 'spacer' }),
    h('button', { class: 'btn ghost-dark', onclick: () => update({ focus: null, compare: [] }) }, 'Clear'),
    h('button', { class: 'btn primary', onclick: () => update({ page: 'disease' }) },
      n > 1 ? `Compare ${n} diseases` : 'Open selected disease', icon('arrow', 15)));
}
