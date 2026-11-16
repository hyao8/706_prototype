// Gene page: a gene, every disease linked to it and their specialties (T3).
import * as d3 from 'd3';
import { D, LEVEL_SHORT, passesBase } from '../data.js';
import { state, update, openDisease, openGene, activeFilterCount } from '../state.js';
import { h, fmt, truncate, withTip, esc } from '../util.js';

const MAX_COGENES = 14;
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
  return h('section', { class: 'panel' },
    h('h2', {}, 'Genes linked to the most diseases'),
    h('p', { class: 'sub' }, `${fmt(D.genes.length)} genes in total. Click one to see its diseases, or search any gene at the top.`),
    h('div', { class: 'rank-list' }, top.map((g) => h('button', {
      class: `rank-row${g.idx === state.gene ? ' selected' : ''}`, title: g.name, onclick: () => openGene(g.idx),
    },
    h('span', { class: 'rank-name' }, g.symbol),
    h('span', { class: 'rank-bar' }, h('i', { style: `width:${(g.diseases.length / max) * 100}%` })),
    h('span', { class: 'rank-num' }, g.diseases.length)))));
}

// ------------------------------------------------------ links + context

function genePanels() {
  if (state.gene === null) {
    return [h('section', { class: 'panel empty-state' },
      h('h2', {}, 'No gene selected'),
      h('p', {}, 'Pick a gene from the ranked list, search a gene symbol at the top, or click a gene symbol anywhere in the app.'))];
  }
  const gene = D.genes[state.gene];
  const diseases = gene.diseases.map((i) => D.diseases[i]);
  const inSet = new Set(gene.diseases);

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
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'View' },
    h('button', { class: mode === 'graph' ? 'on' : '', onclick: () => { viewMode = 'graph'; update({}); } }, 'Graph'),
    h('button', { class: mode === 'matrix' ? 'on' : '', onclick: () => { viewMode = 'matrix'; update({}); } }, 'Matrix'));
  const legend = h('div', { class: 'legend' },
    h('span', { class: 'legend-title' }, 'Association'),
    CATS.map((c) => h('span', { class: 'legend-item' },
      mode === 'graph'
        ? h('span', { html: `<svg width="30" height="8"><line x1="0" x2="30" y1="4" y2="4" stroke="#333" stroke-width="2" ${c.dash ? `stroke-dasharray="${c.dash}"` : ''}/></svg>` })
        : h('b', { class: 'glyph' }, c.glyph),
      c.label)));

  const linkPanel = h('section', { class: 'panel' },
    h('div', { class: 'panel-head' },
      h('div', {},
        h('h2', {}, `${gene.symbol} — gene–disease links`, h('span', { class: 'count' }, `${diseases.length} disease${diseases.length > 1 ? 's' : ''}`)),
        h('p', { class: 'sub' }, `${gene.name}${gene.locus ? ` · locus ${gene.locus}` : ''}. Genes are on the left, diseases on the right, grouped by main specialty. Hover to trace links; click a disease to open its profile.`)),
      h('div', { class: 'head-actions' },
        seg,
        h('button', {
          class: 'btn primary', title: 'Open these diseases in the sign comparison matrix',
          onclick: () => update({ page: 'disease', focus: ordered[0].idx, compare: ordered.slice(1, 12).map((d) => d.idx) }),
        }, diseases.length > 1 ? `Compare their signs →` : 'Open disease →'))),
    legend);

  const chart = mode === 'graph'
    ? bipartite(gene, genes, groups, ordered, links, outside)
    : matrix(gene, genes, groups, links, outside);
  linkPanel.append(h('div', { class: 'scroll-x' }, chart));

  const notes = [];
  if (coAll.length > coGenes.length) notes.push(`${coAll.length - coGenes.length} more genes are linked to these diseases and are not drawn (the ${MAX_COGENES} sharing the most diseases with ${gene.symbol} are shown).`);
  if (outside.size) notes.push(`${outside.size} of ${diseases.length} diseases are greyed out because they do not pass the current filters.`);
  if (!coAll.length) notes.push(`No other gene is linked to these diseases.`);
  linkPanel.append(h('p', { class: 'note' }, 'Circle size = number of diseases linked to the gene in the whole dataset. ', notes.join(' ')));

  return [linkPanel, contextPanel(gene, diseases, inSet)];
}

function bipartite(gene, genes, groups, ordered, links, outside) {
  const W = Math.max(760, (document.querySelector('main')?.clientWidth || 1150) - 28 - 280 - 12 - 52);
  const rowH = 21;
  const groupGap = 26;
  const xGene = 150;
  const xDis = Math.min(W - 400, Math.max(360, W * 0.46));
  const top = 30;

  // disease positions
  const yDis = new Map();
  const headers = [];
  let y = top;
  for (const [pref, list] of groups) {
    headers.push({ y, label: pref >= 0 ? D.specialties[pref].label : 'No main specialty', n: list.length });
    y += 18;
    for (const d of list) {
      yDis.set(d.idx, y);
      y += rowH;
    }
    y += groupGap - 18;
  }
  const disBottom = y;

  // gene positions: focus gene first, the others ordered by where their diseases sit
  const meanY = (g) => d3.mean(links.filter((l) => l.g === g.idx), (l) => yDis.get(l.d.idx));
  const others = genes.slice(1).sort((a, b) => meanY(a) - meanY(b));
  const rScale = d3.scaleSqrt().domain([1, D.topGenes[0].diseases.length]).range([4, 13]);
  const H = Math.max(disBottom, top + genes.length * 30 + 20);
  const yGene = new Map();
  yGene.set(gene.idx, others.length ? top + 16 : (top + disBottom) / 2 - 10);
  const step = others.length ? Math.max(28, (H - top - 80) / others.length) : 0;
  others.forEach((g, i) => yGene.set(g.idx, top + 66 + i * step));

  const svg = d3.create('svg').attr('width', W).attr('height', Math.max(H, top + 66 + others.length * step)).attr('class', 'chart bipartite');
  svg.append('text').attr('x', xGene).attr('y', 12).attr('text-anchor', 'middle').attr('class', 'sec-title').text('Genes');
  svg.append('text').attr('x', xDis + 12).attr('y', 12).attr('class', 'sec-title').text('Diseases, by main specialty');

  const path = d3.linkHorizontal().source((l) => [xGene, yGene.get(l.g)]).target((l) => [xDis, yDis.get(l.d.idx)]);
  const link = svg.append('g').attr('fill', 'none').selectAll('path').data(links).join('path')
    .attr('d', path)
    .attr('class', (l) => `link${l.g === gene.idx ? ' main' : ''}`)
    .attr('stroke-dasharray', (l) => l.cat.dash);

  for (const hd of headers) {
    svg.append('text').attr('x', xDis + 12).attr('y', hd.y + 6).attr('class', 'group-label').text(`${hd.label} (${hd.n})`);
  }

  const gNode = svg.append('g').selectAll('g').data(genes).join('g')
    .attr('transform', (g) => `translate(${xGene},${yGene.get(g.idx)})`)
    .attr('class', (g) => `gnode${g.idx === gene.idx ? ' main' : ''}`)
    .style('cursor', 'pointer')
    .on('click', (e, g) => { if (g.idx !== gene.idx) openGene(g.idx); });
  gNode.append('circle').attr('r', (g) => rScale(g.diseases.length));
  gNode.append('text').attr('x', (g) => -rScale(g.diseases.length) - 6).attr('dy', '0.35em').attr('text-anchor', 'end').text((g) => g.symbol);
  withTip(gNode, (g) => `<b>${esc(g.symbol)}</b> — ${esc(g.name)}<br>${g.diseases.length} diseases in the dataset${g.idx !== gene.idx ? '<br><span class="tip-note">click to focus this gene</span>' : ''}`);

  const dNode = svg.append('g').selectAll('g').data(ordered).join('g')
    .attr('transform', (d) => `translate(${xDis},${yDis.get(d.idx)})`)
    .attr('class', (d) => `dnode${outside.has(d.idx) ? ' outside' : ''}${d.idx === state.focus ? ' focus' : ''}`)
    .style('cursor', 'pointer')
    .on('click', (e, d) => openDisease(d.idx));
  dNode.append('circle').attr('r', 4.5);
  dNode.append('text').attr('x', 12).attr('dy', '0.35em')
    .text((d) => `${truncate(d.name, Math.floor((W - xDis - 70) / 6.4))}${d.level !== 1 ? `  [${LEVEL_SHORT[d.level]}]` : ''}`);
  withTip(dNode, (d) => `<b>${esc(d.name)}</b><br>ORPHA:${d.code} · ${LEVEL_SHORT[d.level]}<br>${d.links.filter((l) => l.g === gene.idx).map((l) => esc(D.vocab.assoc[l.a])).join('<br>')}${outside.has(d.idx) ? '<br><span class="tip-note">does not pass the current filters</span>' : ''}<br><span class="tip-note">click to open the profile</span>`);

  // hover: light up the links of one node and say how many
  const highlight = (test) => {
    link.classed('dim', (l) => test && !test(l)).classed('hot', (l) => test && test(l));
    gNode.classed('dim', (g) => test && !links.some((l) => test(l) && l.g === g.idx));
    dNode.classed('dim', (d) => test && !links.some((l) => test(l) && l.d.idx === d.idx));
  };
  gNode.on('mouseenter', (e, g) => highlight((l) => l.g === g.idx)).on('mouseleave', () => highlight(null));
  dNode.on('mouseenter', (e, d) => highlight((l) => l.d.idx === d.idx)).on('mouseleave', () => highlight(null));
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
  const byPref = d3.rollups(diseases, (v) => v.length, (d) => d.pref).sort((a, b) => b[1] - a[1]);
  const byAny = new Map();
  for (const d of diseases) for (const s of d.specs) byAny.set(s, (byAny.get(s) || 0) + 1);
  const prefCount = new Map(byPref);
  const rows = [...byAny].sort((a, b) => (prefCount.get(b[0]) || 0) - (prefCount.get(a[0]) || 0) || b[1] - a[1]);
  const max = diseases.length;
  return h('section', { class: 'panel' },
    h('h2', {}, `Where ${gene.symbol}'s diseases fall`, h('span', { class: 'count' }, `${byPref.length} main specialt${byPref.length > 1 ? 'ies' : 'y'}`)),
    h('p', { class: 'sub' }, 'Dark = diseases whose main specialty this is. Light = diseases that also belong to it. Click a row to select the specialty on the Overview page.'),
    h('div', { class: 'rank-list wide' }, rows.map(([s, n]) => h('button', {
      class: 'rank-row', onclick: () => update({ page: 'overview', specialties: [s], specMode: 'any', countBy: 'all' }),
    },
    h('span', { class: 'rank-name' }, D.specialties[s].label),
    h('span', { class: 'rank-bar' }, h('i', { class: 'light', style: `width:${(n / max) * 100}%` }), h('i', { style: `width:${((prefCount.get(s) || 0) / max) * 100}%` })),
    h('span', { class: 'rank-num' }, `${prefCount.get(s) || 0} main · ${n} in total`)))));
}
