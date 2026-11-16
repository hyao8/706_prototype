// Gene page: a gene, every disease linked to it and their specialties (T3).
import * as d3 from 'd3';
import { D, LEVEL_SHORT, passesBase } from '../data.js';
import { state, update, openDisease, openGene, activeFilterCount } from '../state.js';
import { h, fmt, truncate, withTip, esc, icon, chartWidth, ACCENT, MARK } from '../util.js';

const MAX_COGENES = 14;
const SIDE_W = 296; // ranked-gene column + gap, see .gene-grid
const EXAMPLES = ['FBN1', 'CFTR', 'TP53', 'LMNA', 'COL2A1'];
let viewMode = 'auto'; // 'auto' | 'graph' | 'matrix'

// Association types folded into four line styles.
const CATS = [
  { id: 'causal', label: 'Disease-causing (germline)', dash: null, glyph: '●' },
  { id: 'somatic', label: 'Somatic mutation / fusion gene', dash: '7 3', glyph: '◆' },
  { id: 'modifier', label: 'Susceptibility, modifier or role in phenotype', dash: '3 3', glyph: '○' },
  { id: 'candidate', label: 'Candidate gene / biomarker tested', dash: '1 4', glyph: '·' },
];
function category(assocIdx) {
  const name = D.vocab.assoc[assocIdx];
  if (name.includes('germline mutation(s)') && name.startsWith('Disease-causing')) return CATS[0];
  if (name.includes('somatic') || name.includes('fusion')) return CATS[1];
  if (name.includes('Candidate') || name.includes('Biomarker')) return CATS[3];
  return CATS[2];
}

export function renderGene(root) {
  root.append(h('div', { class: 'gene-grid' }, topGenesPanel(), h('div', { class: 'stack' }, ...genePanels())));
}

// ------------------------------------------------------------ ranked genes

function topGenesPanel() {
  const top = D.topGenes.slice(0, 40);
  const max = top[0].diseases.length;
  return h('section', { class: 'panel side' },
    h('h2', {}, icon('gene', 17), 'Most-linked genes'),
    h('p', { class: 'sub' }, `The 40 genes linked to the most diseases, of ${fmt(D.genes.length)} genes. Click one, or search any gene at the top.`),
    h('div', { class: 'rank-list' }, top.map((g) => h('button', {
      class: `rank-row${g.idx === state.gene ? ' selected' : ''}`, title: `${g.name} — ${g.diseases.length} diseases`, onclick: () => openGene(g.idx),
    },
    h('span', { class: 'rank-name' }, g.symbol),
    h('span', { class: 'rank-bar' }, h('i', { style: `width:${(g.diseases.length / max) * 100}%` })),
    h('span', { class: 'rank-num' }, g.diseases.length)))));
}

// ------------------------------------------------------ links + context

function genePanels() {
  if (state.gene === null) {
    return [h('section', { class: 'panel empty-state' },
      h('div', { class: 'empty-icon' }, icon('gene', 28)),
      h('h2', {}, 'No gene selected'),
      h('p', {}, 'Pick a gene from the ranked list, search a gene symbol at the top, or click a gene symbol anywhere in the app.'),
      h('div', { class: 'examples' }, h('span', { class: 'k' }, 'Examples'), EXAMPLES.map((symbol) => {
        const g = D.geneBySymbol.get(symbol);
        return g === undefined ? null : h('button', { class: 'btn gene', onclick: () => openGene(g) }, symbol);
      })))];
  }
  const gene = D.genes[state.gene];
  const diseases = gene.diseases.map((i) => D.diseases[i]);

  // other genes linked to the same diseases, most shared first
  const shared = new Map();
  for (const d of diseases) for (const g of d.gs) if (g !== gene.idx) shared.set(g, (shared.get(g) || 0) + 1);
  const coAll = [...shared].sort((a, b) => b[1] - a[1] || D.genes[a[0]].symbol.localeCompare(D.genes[b[0]].symbol));
  const coGenes = coAll.slice(0, MAX_COGENES).map(([g]) => D.genes[g]);
  const genes = [gene, ...coGenes];
  const geneSet = new Set(genes.map((g) => g.idx));

  // diseases grouped by main specialty, biggest group first
  const groups = d3.groups(diseases, (d) => d.pref).sort((a, b) => b[1].length - a[1].length);
  groups.forEach(([, list]) => list.sort((a, b) => a.name.localeCompare(b.name)));
  const ordered = groups.flatMap(([, list]) => list);
  const links = ordered.flatMap((d) => d.links.filter((l) => geneSet.has(l.g)).map((l) => ({ d, g: l.g, cat: category(l.a), a: l.a })));
  const filtersOn = activeFilterCount() > 0;
  const outside = new Set(filtersOn ? ordered.filter((d) => !passesBase(d)).map((d) => d.idx) : []);

  const mode = viewMode === 'auto' ? (links.length > 90 ? 'matrix' : 'graph') : viewMode;
  const setMode = (m) => () => {
    viewMode = m;
    update({});
  };
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'View' },
    h('button', { class: mode === 'graph' ? 'on' : '', 'aria-pressed': String(mode === 'graph'), onclick: setMode('graph') }, 'Graph'),
    h('button', { class: mode === 'matrix' ? 'on' : '', 'aria-pressed': String(mode === 'matrix'), onclick: setMode('matrix') }, 'Matrix'));
  const legend = h('div', { class: 'legend' },
    h('span', { class: 'legend-title' }, 'Association'),
    CATS.map((c) => h('span', { class: 'legend-item' },
      mode === 'graph'
        ? h('span', { class: 'line-key', html: `<svg width="30" height="8"><line x1="0" x2="30" y1="4" y2="4" stroke="currentColor" stroke-width="2" ${c.dash ? `stroke-dasharray="${c.dash}"` : ''}/></svg>` })
        : h('b', { class: 'glyph' }, c.glyph),
      c.label)),
    mode === 'graph' ? [
      h('span', { class: 'legend-sep' }),
      h('span', { class: 'legend-item' }, h('i', { class: 'dot', style: `background:${ACCENT}` }), `${gene.symbol} (selected)`),
      h('span', { class: 'legend-item' }, h('i', { class: 'dot', style: `background:${MARK}` }), 'other genes and diseases'),
    ] : null);

  const linkPanel = h('section', { class: 'panel' },
    h('div', { class: 'panel-head' },
      h('div', {},
        h('h2', {}, icon('link', 17), 'Gene–disease links', h('span', { class: 'count' }, `${diseases.length} disease${diseases.length > 1 ? 's' : ''} · ${genes.length} gene${genes.length > 1 ? 's' : ''}`)),
        h('p', { class: 'sub' }, mode === 'graph'
          ? 'Genes are on the left, diseases on the right, grouped by main specialty. Hover a node to trace its links; click a disease to open its profile.'
          : 'Rows are diseases, grouped by main specialty; columns are genes. A symbol marks a link and its type. Click a disease to open its profile.')),
      h('div', { class: 'head-actions' },
        seg,
        h('button', {
          class: 'btn primary', title: 'Open these diseases in the sign comparison matrix',
          onclick: () => update({ page: 'disease', focus: ordered[0].idx, compare: ordered.slice(1, 12).map((d) => d.idx) }),
        }, diseases.length > 1 ? 'Compare their signs' : 'Open disease', icon('arrow', 15)))),
    legend);

  const chart = mode === 'graph'
    ? bipartite(gene, genes, groups, ordered, links, outside)
    : matrix(gene, genes, groups, links, outside);
  linkPanel.append(h('div', { class: 'scroll-x' }, chart));

  const notes = [];
  if (mode === 'graph') notes.push('Circle size = number of diseases linked to the gene in the whole dataset.');
  if (coAll.length > coGenes.length) notes.push(`${coAll.length - coGenes.length} more genes are linked to these diseases and are not drawn (the ${MAX_COGENES} sharing the most diseases with ${gene.symbol} are shown).`);
  if (outside.size) notes.push(`${outside.size} of ${diseases.length} diseases are greyed out because they do not pass the current filters.`);
  if (!coAll.length) notes.push('No other gene is linked to these diseases.');
  if (notes.length) linkPanel.append(h('p', { class: 'note' }, icon('info', 14), h('span', {}, notes.join(' '))));

  return [heroPanel(gene, diseases, groups, coAll, links), linkPanel, contextPanel(gene, diseases)];
}

/** Name, locus and the figures people ask about first. */
function heroPanel(gene, diseases, groups, coAll, links) {
  const fact = (iconName, label, value, sub) => h('div', { class: 'fact' },
    h('div', { class: 'stat-label' }, icon(iconName, 14), label),
    h('div', { class: 'fact-value', title: typeof value === 'string' ? value : '' }, value),
    h('div', { class: 'stat-sub', title: sub }, sub));
  const levels = [1, 2, 0].map((l) => [diseases.filter((d) => d.level === l).length, LEVEL_SHORT[l].toLowerCase()])
    .filter(([n]) => n).map(([n, name]) => `${n} ${name}${n > 1 ? 's' : ''}`).join(', ');
  const own = links.filter((l) => l.g === gene.idx);
  const causal = new Set(own.filter((l) => l.cat === CATS[0]).map((l) => l.d.idx)).size;
  const named = groups.filter(([pref]) => pref >= 0);
  const topSpec = named.length ? D.specialties[named[0][0]].label : null;
  const co = coAll.slice(0, 3).map(([g]) => D.genes[g].symbol).join(', ');

  return h('section', { class: 'panel profile' },
    h('div', { class: 'hero' },
      h('div', { class: 'hero-main' },
        h('div', { class: 'kicker' }, 'Gene'),
        h('h1', { class: 'symbol' }, gene.symbol),
        h('p', { class: 'sub' }, h('span', {}, gene.name), gene.locus ? h('span', {}, `Locus ${gene.locus}`) : null))),
    h('div', { class: 'facts four' },
      fact('disease', 'Diseases linked', fmt(diseases.length), levels),
      fact('check', 'Disease-causing', fmt(causal), causal === diseases.length ? 'germline, in every linked disease' : `germline, of ${diseases.length} linked diseases`),
      fact('layers', 'Main specialties', fmt(named.length), topSpec ? `most in ${topSpec}` : 'no main specialty recorded'),
      fact('link', 'Related genes', fmt(coAll.length), coAll.length ? `share a disease: ${co}${coAll.length > 3 ? ` +${coAll.length - 3}` : ''}` : 'no other gene shares its diseases')));
}

function bipartite(gene, genes, groups, ordered, links, outside) {
  const stacked = window.matchMedia('(max-width: 1180px)').matches; // the ranked list moves above
  const W = Math.max(600, chartWidth(0) - (stacked ? 0 : SIDE_W));
  const rowH = 22;
  const groupGap = 28;
  const xGene = 130;
  const xDis = Math.max(xGene + 170, Math.min(W - 400, W * 0.46));
  const top = 34;

  // disease positions
  const yDis = new Map();
  const headers = [];
  let y = top;
  for (const [pref, list] of groups) {
    headers.push({ y, label: pref >= 0 ? D.specialties[pref].label : 'No main specialty', n: list.length });
    y += 20;
    for (const d of list) {
      yDis.set(d.idx, y);
      y += rowH;
    }
    y += groupGap - 20;
  }
  const disBottom = y;

  // gene positions: focus gene first, the others ordered by where their diseases sit
  const meanY = (g) => d3.mean(links.filter((l) => l.g === g.idx), (l) => yDis.get(l.d.idx));
  const others = genes.slice(1).sort((a, b) => meanY(a) - meanY(b));
  const rScale = d3.scaleSqrt().domain([1, D.topGenes[0].diseases.length]).range([4.5, 13]);
  const H = Math.max(disBottom, top + genes.length * 30 + 20);
  const yGene = new Map();
  yGene.set(gene.idx, others.length ? top + 18 : (top + disBottom) / 2 - 10);
  const step = others.length ? Math.max(28, (H - top - 84) / others.length) : 0;
  others.forEach((g, i) => yGene.set(g.idx, top + 70 + i * step));

  const svg = d3.create('svg').attr('width', W).attr('height', Math.max(H, top + 70 + others.length * step)).attr('class', 'chart bipartite')
    .attr('role', 'group').attr('aria-label', `Genes and the diseases linked to ${gene.symbol}`);
  svg.append('text').attr('x', xGene).attr('y', 13).attr('text-anchor', 'middle').attr('class', 'sec-title').text('Genes');
  svg.append('text').attr('x', xDis + 12).attr('y', 13).attr('class', 'sec-title').text('Diseases, by main specialty');

  const path = d3.linkHorizontal().source((l) => [xGene, yGene.get(l.g)]).target((l) => [xDis, yDis.get(l.d.idx)]);
  const link = svg.append('g').attr('fill', 'none').selectAll('path').data(links).join('path')
    .attr('d', path)
    .attr('class', (l) => `link${l.g === gene.idx ? ' main' : ''}`)
    .attr('stroke-dasharray', (l) => l.cat.dash);

  for (const hd of headers) {
    svg.append('text').attr('x', xDis + 12).attr('y', hd.y + 6).attr('class', 'group-label').text(`${hd.label} (${hd.n})`);
  }

  const onKey = (action) => (e, d) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action(d);
    }
  };
  const focusGene = (g) => {
    if (g.idx !== gene.idx) openGene(g.idx);
  };
  const gNode = svg.append('g').selectAll('g').data(genes).join('g')
    .attr('transform', (g) => `translate(${xGene},${yGene.get(g.idx)})`)
    .attr('class', (g) => `gnode${g.idx === gene.idx ? ' main' : ''}`)
    .attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', (g) => `Gene ${g.symbol}, ${g.diseases.length} diseases`)
    .on('click', (e, g) => focusGene(g))
    .on('keydown', onKey(focusGene));
  gNode.append('circle').attr('r', (g) => rScale(g.diseases.length));
  gNode.append('text').attr('x', (g) => -rScale(g.diseases.length) - 7).attr('dy', '0.35em').attr('text-anchor', 'end').text((g) => g.symbol);
  withTip(gNode, (g) => `<b>${esc(g.symbol)}</b> · ${esc(g.name)}<br><b>${g.diseases.length}</b> diseases in the dataset${g.idx !== gene.idx ? '<br><span class="tip-note">click to focus this gene</span>' : ''}`);

  const dNode = svg.append('g').selectAll('g').data(ordered).join('g')
    .attr('transform', (d) => `translate(${xDis},${yDis.get(d.idx)})`)
    .attr('class', (d) => `dnode${outside.has(d.idx) ? ' outside' : ''}${d.idx === state.focus ? ' focus' : ''}`)
    .attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', (d) => `${d.name}. Open the profile.`)
    .on('click', (e, d) => openDisease(d.idx))
    .on('keydown', onKey((d) => openDisease(d.idx)));
  dNode.append('circle').attr('r', 4.5);
  dNode.append('text').attr('x', 12).attr('dy', '0.35em')
    .text((d) => `${truncate(d.name, Math.floor((W - xDis - 70) / 6.6))}${d.level !== 1 ? `  [${LEVEL_SHORT[d.level]}]` : ''}`);
  withTip(dNode, (d) => `<b>${esc(d.name)}</b><br>ORPHA:${d.code} · ${LEVEL_SHORT[d.level]}<br>${d.links.filter((l) => l.g === gene.idx).map((l) => esc(D.vocab.assoc[l.a])).join('<br>')}${outside.has(d.idx) ? '<br><span class="tip-note">does not pass the current filters</span>' : ''}<br><span class="tip-note">click to open the profile</span>`);

  // hover: light up the links of one node
  const highlight = (test) => {
    link.classed('dim', (l) => test && !test(l)).classed('hot', (l) => test && test(l));
    gNode.classed('dim', (g) => test && !links.some((l) => test(l) && l.g === g.idx));
    dNode.classed('dim', (d) => test && !links.some((l) => test(l) && l.d.idx === d.idx));
  };
  gNode.on('mouseenter', (e, g) => highlight((l) => l.g === g.idx)).on('mouseleave', () => highlight(null))
    .on('focus', (e, g) => highlight((l) => l.g === g.idx)).on('blur', () => highlight(null));
  dNode.on('mouseenter', (e, d) => highlight((l) => l.d.idx === d.idx)).on('mouseleave', () => highlight(null))
    .on('focus', (e, d) => highlight((l) => l.d.idx === d.idx)).on('blur', () => highlight(null));
  return svg.node();
}

function matrix(gene, genes, groups, links, outside) {
  const byPair = d3.group(links, (l) => `${l.d.idx}|${l.g}`);
  const head = h('tr', {}, h('th', {}, 'Disease'), genes.map((g) => h('th', { class: `gcol${g.idx === gene.idx ? ' main' : ''}` },
    h('button', { class: 'link gene', title: g.name, onclick: () => openGene(g.idx) }, g.symbol))));
  const body = groups.flatMap(([pref, list]) => [
    h('tr', { class: 'group-row' }, h('td', { colSpan: genes.length + 1 }, `${pref >= 0 ? D.specialties[pref].label : 'No main specialty'} (${list.length})`)),
    ...list.map((d) => h('tr', { class: outside.has(d.idx) ? 'outside' : '' },
      h('td', {}, h('button', { class: 'link name', title: d.name, onclick: () => openDisease(d.idx) }, truncate(d.name, 52)),
        d.level !== 1 ? h('span', { class: 'tag' }, LEVEL_SHORT[d.level]) : null),
      genes.map((g) => {
        const ls = byPair.get(`${d.idx}|${g.idx}`);
        return h('td', { class: `mcell${g.idx === gene.idx ? ' main' : ''}`, title: ls ? `${g.symbol}: ${ls.map((l) => D.vocab.assoc[l.a]).join('; ')}` : '' }, ls ? ls[0].cat.glyph : '');
      }))),
  ]);
  return h('table', { class: 'list gmatrix' }, h('thead', {}, head), h('tbody', {}, body));
}

function contextPanel(gene, diseases) {
  const byPref = d3.rollups(diseases, (v) => v.length, (d) => d.pref).filter(([pref]) => pref >= 0).sort((a, b) => b[1] - a[1]);
  const byAny = new Map();
  for (const d of diseases) for (const s of d.specs) byAny.set(s, (byAny.get(s) || 0) + 1);
  const prefCount = new Map(byPref);
  const rows = [...byAny].sort((a, b) => (prefCount.get(b[0]) || 0) - (prefCount.get(a[0]) || 0) || b[1] - a[1]);
  const max = diseases.length;
  return h('section', { class: 'panel' },
    h('h2', {}, icon('layers', 17), `Where ${gene.symbol}'s diseases fall`, h('span', { class: 'count' }, `${byPref.length} main specialt${byPref.length === 1 ? 'y' : 'ies'}`)),
    h('p', { class: 'sub' }, 'How many of the linked diseases each specialty covers. Click a row to select the specialty on the Overview page.'),
    h('div', { class: 'legend' },
      h('span', { class: 'legend-item' }, h('i', { class: 'box', style: `background:${MARK}` }), 'Main specialty of the disease'),
      h('span', { class: 'legend-item' }, h('i', { class: 'box light' }), 'Disease also belongs to it')),
    h('div', { class: 'rank-list wide' }, rows.map(([s, n]) => h('button', {
      class: 'rank-row', title: `${D.specialties[s].label} — select it on the Overview page`,
      onclick: () => update({ page: 'overview', specialties: [s], specMode: 'any', countBy: 'all' }),
    },
    h('span', { class: 'rank-name' }, D.specialties[s].label),
    h('span', { class: 'rank-bar' }, h('i', { class: 'light', style: `width:${(n / max) * 100}%` }), h('i', { style: `width:${((prefCount.get(s) || 0) / max) * 100}%` })),
    h('span', { class: 'rank-num' }, h('b', {}, prefCount.get(s) || 0), ' main · ', h('b', {}, n), ' in total')))));
}
