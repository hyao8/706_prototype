// Disease page: one disease's profile (T2) and the sign comparison matrix (T5).
import * as d3 from 'd3';
import { D, FREQ_SHORT, FREQ_RANGE, FREQ_WEIGHT, PREV_SHORT, LEVEL_SHORT, prevLabel, searchDiseases, similarBySigns, sharingGenes } from '../data.js';
import { state, update, openDisease, openGene } from '../state.js';
import { h, fmt, truncate, withTip, esc, autocomplete, FREQ_COLOR, prevColor } from '../util.js';

let showAllColumns = false;
const CELL = 18;
const ONSET_SHORT = { Childhood: 'Child', Adolescent: 'Adolesc.' };
const LABEL_W = 300;
const EXAMPLES = ['Marfan syndrome', 'Loeys-Dietz syndrome', 'Cystic fibrosis', 'Huntington disease'];

export function renderDisease(root) {
  if (state.focus === null) {
    root.append(h('section', { class: 'panel empty-state' },
      h('h2', {}, 'No disease selected'),
      h('p', {}, 'Search for a disease in the box at the top, or click a disease name on the Overview or Gene page.'),
      h('p', {}, 'Examples: ', EXAMPLES.map((name) => {
        const d = D.diseases.find((x) => x.name === name);
        return d ? h('button', { class: 'btn', onclick: () => openDisease(d.idx) }, name) : null;
      }))));
    return;
  }
  const d = D.diseases[state.focus];
  root.append(profilePanel(d), matrixPanel(d));
}

// ------------------------------------------------------------------ profile

function profilePanel(d) {
  const coverage = [
    ['Genes', d.gs.length > 0], ['Clinical signs', d.signs.size > 0],
    ['Prevalence', d.pc >= 0], ['Onset', d.onset.length > 0], ['Inheritance', d.inh.length > 0],
  ];
  const panel = h('section', { class: 'panel profile' },
    h('div', { class: 'panel-head' },
      h('div', {},
        h('h2', {}, d.name),
        h('p', { class: 'sub' },
          h('a', { href: `https://www.orpha.net/en/disease/detail/${d.code}`, target: '_blank', rel: 'noopener' }, `ORPHA:${d.code}`),
          ` · ${LEVEL_SHORT[d.level]} · ${D.vocab.types[d.type]}`,
          d.syn.length ? ` · also: ${truncate(d.syn.slice(0, 3).join('; '), 90)}` : ''))),
    h('div', { class: 'coverage', title: 'Which kinds of data Orphadata holds for this disease' },
      h('span', { class: 'k' }, 'Data available'),
      coverage.map(([label, ok]) => h('span', { class: ok ? 'cov yes' : 'cov no' }, ok ? '✓ ' : '✗ ', label))));

  // three columns: classification + genes | epidemiology + natural history | signs
  const col1 = h('div', {});
  const col2 = h('div', {});
  const col3 = h('div', {});
  panel.append(h('div', { class: 'profile-cols' }, col1, col2, col3));

  // specialties
  const others = d.specs.filter((s) => s !== d.pref);
  col1.append(block('Specialties',
    d.pref >= 0 ? specChip(d.pref, true) : h('span', { class: 'muted' }, 'no main specialty'),
    others.map((s) => specChip(s, false)),
    h('p', { class: 'hint' }, 'Bold = main (preferential) specialty. Others are additional classifications.')));

  // genes
  col1.append(block(`Genes (${d.gs.length})`, d.links.length
    ? h('table', { class: 'mini' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Gene'), h('th', {}, 'Locus'), h('th', {}, 'Association'))),
      h('tbody', {}, d.links.slice(0, 8).map((l) => {
        const g = D.genes[l.g];
        return h('tr', {},
          h('td', {}, h('button', { class: 'link gene', title: `${g.name} — open on the Gene page`, onclick: () => openGene(g.idx) }, g.symbol)),
          h('td', {}, g.locus || '–'),
          h('td', {}, D.vocab.assoc[l.a], D.vocab.assocStatus[l.st] !== 'Assessed' ? h('span', { class: 'tag' }, 'not yet assessed') : null));
      })),
      d.links.length > 8 ? h('tfoot', {}, h('tr', {}, h('td', { colSpan: 3, class: 'muted' }, `+ ${d.links.length - 8} more — see the comparison matrix or the Gene page`))) : null)
    : h('p', { class: 'muted' }, d.level === 1 ? 'No gene association recorded for this disorder. Its subtypes may carry them.' : 'No gene association recorded.')));

  // prevalence on its ordinal scale
  const prevNote = d.pc >= 0 ? `Based on: ${d.pb}` : d.pc === -1 ? 'Records exist, but none gives a prevalence class. Shown as unknown, not as zero.' : 'No epidemiology record in Orphadata.';
  col2.append(block('Prevalence',
    scale(PREV_SHORT, (i) => i === d.pc, (i) => prevColor(i), 'rarer', 'more common'),
    h('p', { class: 'hint' }, prevNote),
    d.prev.length ? h('details', {}, h('summary', {}, `${d.prev.length} source record${d.prev.length > 1 ? 's' : ''} (provenance)`),
      h('table', { class: 'mini' },
        h('thead', {}, h('tr', {}, ['Type', 'Class / value', 'Region', 'Status', 'Source'].map((t) => h('th', {}, t)))),
        h('tbody', {}, d.prev.map(([type, cls, val, geo, valid, qual, source]) => h('tr', {},
          h('td', {}, D.vocab.prevType[type]),
          h('td', {}, cls >= 0 ? PREV_SHORT[cls] : qual.startsWith('Case') || qual.startsWith('Famil') ? `${val ?? '?'} ${qual.toLowerCase()}` : 'unknown',
            cls >= 0 && val ? h('span', { class: 'muted' }, ` (${val} per 100k)`) : null),
          h('td', {}, D.vocab.geo[geo]),
          h('td', {}, D.vocab.valid[valid]),
          h('td', { class: 'src', title: source }, truncate(source.replace(/_/g, ', '), 34))))))) : null));

  // onset + inheritance
  col2.append(block('Age of onset', d.onset.length
    ? scale(D.vocab.onset.map((o) => ONSET_SHORT[o] || o), (i) => d.onset.includes(i), () => '#5b6b7d', 'earlier', 'later')
    : h('p', { class: 'muted' }, 'No data')));
  col2.append(block('Inheritance', d.inh.length ? d.inh.map((i) => h('span', { class: 'chip plain' }, D.vocab.inheritance[i])) : h('p', { class: 'muted' }, 'No data')));

  // clinical signs
  const signs = [...d.signs].sort((a, b) => b[1] - a[1] || D.signs[a[0]].term.localeCompare(D.signs[b[0]].term));
  const signRow = ([s, f]) => h('div', { class: 'sign-row' },
    h('span', { class: 'sign-name', title: `${D.signs[s].term} (${D.signs[s].id})` }, truncate(D.signs[s].term, 40)),
    h('span', { class: 'sign-bar' }, f === 0 ? h('span', { class: 'muted' }, 'excluded') : h('i', { style: `width:${FREQ_WEIGHT[f] * 100}%;background:${FREQ_COLOR[Math.max(f, 2)]}` })),
    h('span', { class: 'sign-freq' }, f === 0 ? '0%' : `${FREQ_SHORT[f]}`),
    h('button', {
      class: 'link small', disabled: state.signs.includes(s), title: 'Use this sign as a filter',
      onclick: () => update((st) => ({ signs: [...st.signs, s] })),
    }, state.signs.includes(s) ? 'in filter' : '+ filter'));
  col3.append(block(`Clinical signs (${signs.length})`, signs.length
    ? [h('p', { class: 'hint' }, 'Bar length = how often patients show the sign. Most frequent first.'),
      signs.slice(0, 10).map(signRow),
      signs.length > 10 ? h('details', {}, h('summary', {}, `Show ${signs.length - 10} more signs`), signs.slice(10).map(signRow)) : null]
    : h('p', { class: 'muted' }, 'No clinical signs annotated for this disease.')));
  return panel;
}

function block(title, ...children) {
  return h('div', { class: 'block' }, h('h3', {}, title), children);
}

function specChip(s, main) {
  return h('button', {
    class: `chip plain click${main ? ' main' : ''}`, title: 'Select this specialty on the Overview page',
    onclick: () => update({ page: 'overview', specialties: [s], specMode: 'any', countBy: main ? 'pref' : 'all' }),
  }, D.specialties[s].label);
}

/** An ordinal scale drawn as a row of boxes, with the disease's value(s) filled. */
function scale(labels, isOn, color, left, right) {
  return h('div', { class: 'scale-wrap' },
    h('div', { class: 'scale' }, labels.map((label, i) => {
      const on = isOn(i);
      const dark = on && d3.hsl(color(i)).l < 0.6;
      return h('span', { class: on ? 'on' : '', title: label, style: on ? `background:${color(i)};color:${dark ? '#fff' : '#111'}` : '' }, label);
    })),
    h('div', { class: 'scale-ends' }, h('span', {}, `← ${left}`), h('span', {}, `${right} →`)));
}

// ------------------------------------------------------- comparison matrix

function matrixPanel(focus) {
  const rows = [focus, ...state.compare.map((i) => D.diseases[i])];
  const withData = rows.filter((r) => r.signs.size);

  // columns = signs seen in any row; a column is kept if at least one row
  // shows it at the minimum frequency set in the filter panel
  const stats = new Map();
  for (const r of withData) {
    for (const [s, f] of r.signs) {
      if (!stats.has(s)) stats.set(s, { s, max: 0, n: 0 });
      const c = stats.get(s);
      c.max = Math.max(c.max, f);
      c.n += 1;
    }
  }
  let cols = [...stats.values()].filter((c) => c.max >= state.minFreq);
  for (const c of cols) {
    const w = withData.map((r) => FREQ_WEIGHT[r.signs.get(c.s) ?? 0]);
    c.spread = d3.deviation(w) || 0; // how well this sign separates the rows
    c.mean = d3.mean(w) || 0;
  }
  const comparing = withData.length > 1;
  cols.sort((a, b) => (comparing ? b.spread - a.spread : 0) || b.mean - a.mean || D.signs[a.s].term.localeCompare(D.signs[b.s].term));
  const totalCols = cols.length;
  // as many columns as fit without scrolling; the rest are one click away
  const avail = (document.querySelector('main')?.clientWidth || 1100) - 78;
  const MAX_COLS = Math.max(12, Math.floor((avail - LABEL_W - 110) / CELL));
  if (!showAllColumns) cols = cols.slice(0, MAX_COLS);

  // ---- chrome: add / suggest ----
  const addInput = h('input', { type: 'search', placeholder: 'Add a disease to compare…', 'aria-label': 'Add a disease to compare' });
  const inSet = new Set(rows.map((r) => r.idx));
  const add = (idx) => update((s) => ({ compare: s.compare.includes(idx) || idx === s.focus ? s.compare : [...s.compare, idx] }));
  const suggest = (label, list, why) => (list.length
    ? h('div', { class: 'suggest' }, h('span', { class: 'k' }, label),
      list.map((x) => h('button', { class: 'chip plain click', title: `${x.name} — ${why}`, onclick: () => add(x.idx) }, '+ ', truncate(x.name, 34))))
    : null);
  const similar = similarBySigns(focus, 8).map((x) => x.d).filter((x) => !inSet.has(x.idx)).slice(0, 5);
  const sharing = sharingGenes(focus, 8).filter((x) => !inSet.has(x.idx)).slice(0, 5);

  const legend = h('div', { class: 'legend' },
    h('span', { class: 'legend-title' }, 'Frequency'),
    [1, 2, 3, 4, 5].map((f) => h('span', { class: 'legend-item' }, h('i', { class: 'box', style: `background:${FREQ_COLOR[f]}` }), `${FREQ_SHORT[f]} ${FREQ_RANGE[f]}`)),
    h('span', { class: 'legend-item' }, h('i', { class: 'box x' }, '×'), 'Excluded'),
    h('span', { class: 'legend-item' }, h('i', { class: 'box empty' }), 'Not annotated'));

  const panel = h('section', { class: 'panel' },
    h('div', { class: 'panel-head' },
      h('div', {},
        h('h2', {}, 'Sign comparison matrix', h('span', { class: 'count' }, `${rows.length} disease${rows.length > 1 ? 's' : ''} × ${cols.length}${cols.length < totalCols ? ` of ${totalCols}` : ''} signs`)),
        h('p', { class: 'sub' }, comparing
          ? 'Rows are diseases, columns are clinical signs. Columns are ordered so that the signs that best tell the diseases apart come first.'
          : 'Add diseases to compare their signs side by side. Columns will then be ordered by how well they tell the diseases apart.')),
      addInput),
    suggest('Similar signs', similar, 'similar sign profile'),
    suggest('Shares a gene', sharing, 'linked to one of the same genes'),
    legend);
  autocomplete(addInput, (q) => searchDiseases(q, 8).filter((x) => !inSet.has(x.idx)).map((x) => ({ label: x.name, sub: `${x.signs.size} signs`, pick: () => add(x.idx) })));

  if (!cols.length) {
    panel.append(h('p', { class: 'empty' }, withData.length
      ? 'No sign reaches the minimum frequency set in the filter panel. Lower it to see more columns.'
      : 'None of these diseases has clinical signs annotated in Orphadata.'));
  }

  // ---- geometry ----
  const cell = CELL;
  const rowH = 26;
  const labelW = LABEL_W;
  const headH = cols.length ? 150 : 8;
  const W = labelW + cols.length * cell + 110;
  const H = headH + rows.length * rowH + 6;
  const svg = d3.create('svg').attr('width', W).attr('height', H).attr('class', 'chart matrix');
  const asked = new Set(state.signs);

  // column headers
  const head = svg.append('g').selectAll('g').data(cols).join('g')
    .attr('transform', (c, j) => `translate(${labelW + j * cell + cell / 2},${headH - 6})`);
  head.append('text').attr('transform', 'rotate(-55)').attr('class', (c) => `col-label${asked.has(c.s) ? ' asked' : ''}`)
    .text((c) => truncate(D.signs[c.s].term, 26));
  withTip(head, (c) => `<b>${esc(D.signs[c.s].term)}</b> (${D.signs[c.s].id})<br>annotated in ${c.n} of ${withData.length} rows${asked.has(c.s) ? '<br><span class="tip-note">one of your filter signs</span>' : ''}`);

  // rows
  rows.forEach((r, i) => {
    const y0 = headH + i * rowH;
    const g = svg.append('g').attr('transform', `translate(0,${y0})`);
    if (r === focus) g.append('rect').attr('width', 4).attr('height', rowH - 4).attr('fill', '#d9480f');
    const fo = g.append('foreignObject').attr('x', 8).attr('width', labelW - 14).attr('height', rowH);
    fo.node().append(h('div', { class: `mrow${r === focus ? ' focus' : ''}` },
      h('button', { class: 'link name', title: `${r.name} — make this the focused disease`, onclick: () => openDisease(r.idx) }, truncate(r.name, 30)),
      h('span', { class: 'mgenes' }, r.gs.slice(0, 2).map((gi) => h('button', { class: 'link gene', title: 'Open on the Gene page', onclick: () => openGene(gi) }, D.genes[gi].symbol)),
        r.gs.length > 2 ? h('span', { class: 'muted' }, `+${r.gs.length - 2}`) : null),
      r !== focus ? h('button', { class: 'x', title: 'Remove from comparison', 'aria-label': `Remove ${r.name}`, onclick: () => update((s) => ({ compare: s.compare.filter((c) => c !== r.idx) })) }, '×') : null));

    if (!r.signs.size) {
      g.append('text').attr('x', labelW + 4).attr('y', rowH / 2).attr('dy', '0.35em').attr('class', 'sec-sub').text('no clinical signs annotated (missing data, not absence)');
      return;
    }
    const cells = g.selectAll('g.cell').data(cols.map((c) => ({ c, f: r.signs.get(c.s) }))).join('g').attr('class', 'cell')
      .attr('transform', (x, j) => `translate(${labelW + j * cell},${(rowH - cell) / 2 - 2})`);
    cells.append('rect').attr('width', cell - 2).attr('height', cell - 2).attr('rx', 2)
      .attr('fill', (x) => (x.f > 0 ? FREQ_COLOR[x.f] : '#fff'))
      .attr('stroke', (x) => (x.f === undefined ? '#e3e6ea' : x.f === 0 ? '#999' : 'none'));
    cells.filter((x) => x.f === 0).append('text').attr('x', (cell - 2) / 2).attr('y', (cell - 2) / 2).attr('dy', '0.35em').attr('text-anchor', 'middle').attr('class', 'xmark').text('×');
    withTip(cells, (x) => `<b>${esc(D.signs[x.c.s].term)}</b><br>${esc(truncate(r.name, 50))}: <b>${x.f === undefined ? 'not annotated' : `${FREQ_SHORT[x.f]} (${FREQ_RANGE[x.f]})`}</b>`);
  });

  panel.append(h('div', { class: 'scroll-x' }, svg.node()));
  if (totalCols > MAX_COLS) {
    panel.append(h('button', { class: 'btn', onclick: () => { showAllColumns = !showAllColumns; update({}); } },
      showAllColumns ? `Show only the top ${MAX_COLS} signs` : `Show all ${fmt(totalCols)} signs`));
  }
  panel.append(h('p', { class: 'note' },
    'Gene symbols next to each name show whether the diseases have different genetic causes. ',
    state.minFreq > 1 ? `Only signs that reach "${FREQ_SHORT[state.minFreq]}" in at least one row are shown (minimum frequency in the filter panel). ` : 'Raise the minimum frequency in the filter panel to hide rare signs. ',
    'An empty cell means the sign is not annotated for that disease.'));
  return panel;
}
