// Entry point: loads the data, builds the page shell (header, filter panel,
// active-selection bar) and redraws the current page whenever the shared
// state changes.
import './style.css';
import { loadData, D, searchDiseases, searchGenes, searchSigns, LEVEL_SHORT, getMatching } from './data.js';
import { state, update, subscribe, openDisease, openGene } from './state.js';
import { h, autocomplete, fmt, hideTip } from './util.js';
import { buildFilters, syncFilters } from './filters.js';
import { renderOverview } from './views/overview.js';
import { renderDisease } from './views/disease.js';
import { renderGene } from './views/gene.js';

const PAGES = [
  { id: 'overview', label: 'Overview', render: renderOverview },
  { id: 'disease', label: 'Disease', render: renderDisease },
  { id: 'gene', label: 'Gene', render: renderGene },
];

const app = document.getElementById('app');
let refs = {};

function buildShell() {
  app.innerHTML = '';
  const search = h('input', { type: 'search', placeholder: 'Search a disease, gene or clinical sign…', 'aria-label': 'Search' });
  refs.tabs = PAGES.map((p) => h('button', { class: 'tab', onclick: () => update({ page: p.id }) }, p.label));
  refs.filters = h('aside', { class: 'filters' });
  refs.active = h('div', { class: 'active-bar' });
  refs.page = h('div', { class: 'page' });

  app.append(
    h('header', { class: 'top' },
      h('div', { class: 'brand' }, 'Orphadata', h('span', {}, 'Rare-Disease Explorer')),
      h('nav', {}, refs.tabs),
      search,
      h('div', { class: 'release', title: `Source files extracted ${D.meta.extracted}` }, `Orphadata · ${D.meta.release} release`),
    ),
    h('div', { class: 'body' }, refs.filters, h('main', {}, refs.active, refs.page)),
    h('footer', {}, D.meta.attribution, ' Prototype v0.1 — BMI 706, Group 7.'),
  );

  autocomplete(search, (q) => [
    ...searchDiseases(q, 7).map((d) => ({
      group: 'Diseases', label: d.name, sub: `ORPHA:${d.code} · ${LEVEL_SHORT[d.level]}`, pick: () => openDisease(d.idx),
    })),
    ...searchGenes(q, 5).map((g) => ({
      group: 'Genes', label: g.symbol, sub: `${g.name} · ${g.diseases.length} diseases`, pick: () => openGene(g.idx),
    })),
    ...searchSigns(q, 5).map((s) => ({
      group: 'Clinical signs (adds a filter)', label: s.term, sub: `${fmt(s.n)} diseases`,
      pick: () => update((st) => ({ signs: st.signs.includes(s.idx) ? st.signs : [...st.signs, s.idx], page: 'overview' })),
    })),
  ]);
  buildFilters(refs.filters);
}

/** The strip above each page: what is currently selected, and how to undo it. */
function renderActive() {
  const el = refs.active;
  el.innerHTML = '';
  const chip = (label, onRemove, onClick) =>
    h('span', { class: 'chip sel' },
      onClick ? h('button', { class: 'chip-main', onclick: onClick }, label) : label,
      h('button', { title: 'Clear', 'aria-label': `Clear ${label}`, onclick: onRemove }, '×'));

  const items = [];
  if (state.specialties.length) {
    const names = state.specialties.map((s) => D.specialties[s].label);
    const label = state.specMode === 'exact' ? `Exactly in: ${names.join(' + ')}` : `Specialty: ${names.join(', ')}`;
    items.push(chip(label, () => update({ specialties: [] }), () => update({ page: 'overview' })));
  }
  if (state.focus !== null) {
    const d = D.diseases[state.focus];
    items.push(chip(`Disease: ${d.name}`, () => update({ focus: null, compare: [] }), () => update({ page: 'disease' })));
  }
  if (state.compare.length) {
    items.push(chip(`Comparing ${state.compare.length + (state.focus !== null ? 1 : 0)} diseases`, () => update({ compare: [] }), () => update({ page: 'disease' })));
  }
  if (state.gene !== null) {
    items.push(chip(`Gene: ${D.genes[state.gene].symbol}`, () => update({ gene: null }), () => update({ page: 'gene' })));
  }
  el.append(
    h('span', { class: 'active-label' }, 'Selection'),
    ...(items.length ? items : [h('span', { class: 'muted' }, 'nothing selected — click a specialty, disease or gene')]),
    h('span', { class: 'spacer' }),
    h('span', { class: 'muted' }, `${fmt(getMatching().length)} entries match the filters`),
  );
}

function render() {
  hideTip();
  refs.tabs.forEach((t, i) => t.classList.toggle('active', PAGES[i].id === state.page));
  if (location.hash.slice(1) !== state.page) history.replaceState(null, '', `#${state.page}`);
  syncFilters();
  renderActive();
  const scroll = window.scrollY;
  refs.page.innerHTML = '';
  PAGES.find((p) => p.id === state.page).render(refs.page);
  if (render.lastPage === state.page) window.scrollTo(0, scroll);
  else window.scrollTo(0, 0);
  render.lastPage = state.page;
}

loadData()
  .then(() => {
    const fromHash = location.hash.slice(1);
    if (PAGES.some((p) => p.id === fromHash)) state.page = fromHash;
    buildShell();
    subscribe(render);
    render();
    window.addEventListener('hashchange', () => {
      const id = location.hash.slice(1);
      if (PAGES.some((p) => p.id === id) && id !== state.page) update({ page: id });
    });
    let timer;
    window.addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(render, 150);
    });
  })
  .catch((err) => {
    app.innerHTML = '';
    app.append(h('p', { class: 'loading' }, `Could not load the data: ${err.message}`));
    console.error(err);
  });
