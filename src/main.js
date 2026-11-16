// Entry point: loads the data, builds the page shell (header, filter panel,
// selection bar, guide) and redraws the current page whenever the shared
// state changes. The state is mirrored in the URL hash.
import '@fontsource-variable/inter';
import './style.css';
import { loadData, D, searchDiseases, searchGenes, searchSigns, LEVEL_SHORT, FREQ_SHORT, getMatching } from './data.js';
import { state, update, subscribe, openDisease, openGene } from './state.js';
import { encodeState, decodeState } from './url.js';
import { h, autocomplete, fmt, hideTip, icon, logo, FREQ_COLOR, PREV_COLOR, PREV_UNKNOWN, PREV_NONE, ACCENT } from './util.js';
import { buildFilters, syncFilters } from './filters.js';
import { renderOverview } from './views/overview.js';
import { renderDisease } from './views/disease.js';
import { renderGene } from './views/gene.js';

const VERSION = 'v0.1';
const REPO = 'https://github.com/hyao8/706_prototype';

const PAGES = [
  { id: 'overview', label: 'Overview', icon: 'overview', render: renderOverview },
  { id: 'disease', label: 'Disease', icon: 'disease', render: renderDisease },
  { id: 'gene', label: 'Gene', icon: 'gene', render: renderGene },
];

const app = document.getElementById('app');
let refs = {};

function buildShell() {
  app.innerHTML = '';
  const search = h('input', { type: 'search', placeholder: 'Search a disease, gene or clinical sign…', 'aria-label': 'Search' });
  refs.search = search;
  refs.tabs = PAGES.map((p) => h('button', { class: 'tab', onclick: () => update({ page: p.id }) }, icon(p.icon, 16), p.label));
  refs.filters = h('aside', { class: 'filters', 'aria-label': 'Filters' });
  refs.active = h('div', { class: 'active-bar' });
  refs.page = h('div', { class: 'page' });
  refs.guide = buildGuide();

  app.append(
    h('header', { class: 'top' },
      h('button', { class: 'brand', title: 'Back to the overview', onclick: () => update({ page: 'overview' }) },
        logo(30), h('span', { class: 'brand-text' }, h('b', {}, 'Orphadata'), h('span', {}, 'Rare-Disease Explorer'))),
      h('nav', { 'aria-label': 'Pages' }, refs.tabs),
      search,
      h('div', { class: 'top-right' },
        h('span', { class: 'release', title: `Source files extracted ${D.meta.extracted}` }, h('i', {}), `${D.meta.release} release`),
        h('button', { class: 'ghost', onclick: () => refs.guide.showModal() }, icon('help', 16), 'Guide')),
    ),
    h('div', { class: 'body' }, refs.filters, h('main', {}, refs.active, refs.page)),
    h('footer', {},
      h('span', {}, D.meta.attribution),
      h('span', {}, `Prototype ${VERSION} · BMI 706, Group 7 · `, h('a', { href: REPO, target: '_blank', rel: 'noopener' }, 'Source on GitHub'))),
    refs.guide,
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
  ], { icon: 'search', hint: '/', blur: true });
  buildFilters(refs.filters);
}

/** A short "how to read this" dialog, opened from the header. */
function buildGuide() {
  const dialog = h('dialog', { class: 'guide', 'aria-label': 'Guide' });
  const go = (action) => () => {
    dialog.close();
    action();
  };
  const c = D.meta.counts;
  const page = (name, title, text, label, action) => h('div', { class: 'guide-card' },
    h('div', { class: 'guide-icon' }, icon(name, 20)),
    h('h3', {}, title),
    h('p', {}, text),
    h('button', { class: 'btn', onclick: go(action) }, label, icon('arrow', 14)));
  const swatches = (colors) => h('span', { class: 'ramp' }, colors.map((col) => h('i', { style: `background:${col}` })));
  const marfan = D.diseaseByCode.get(558);
  const fbn1 = D.geneBySymbol.get('FBN1');

  // the body fills the dialog, so that a click on the dialog itself is a click on the backdrop
  dialog.append(h('div', { class: 'guide-body' },
    h('div', { class: 'guide-head' },
      h('div', {},
        h('h2', {}, 'How to use the explorer'),
        h('p', { class: 'sub' }, `Orphadata is the open data release of Orphanet, the reference knowledge base on rare diseases. This release links ${fmt(c.byLevel[1])} disorders to ${fmt(c.genes)} genes, ${fmt(c.signs)} clinical signs and ${D.specialties.length} medical specialties.`)),
      h('button', { class: 'icon-btn', 'aria-label': 'Close the guide', onclick: () => dialog.close() }, icon('x', 18))),
    h('div', { class: 'guide-cards' },
      page('overview', 'Overview', 'How many disorders each specialty covers, how specialties overlap, how common the diseases are, and a list of diseases you can rank by clinical signs.', 'Open the overview', () => update({ page: 'overview' })),
      page('disease', 'Disease', 'One disease at a glance: genes, signs, prevalence, age of onset and inheritance. Add more diseases to compare their signs side by side.', 'See Marfan syndrome', () => (marfan === undefined ? update({ page: 'disease' }) : openDisease(marfan))),
      page('gene', 'Gene', 'Every disease linked to a gene, the other genes that share those diseases, and the specialties they fall in.', 'See the gene FBN1', () => (fbn1 === undefined ? update({ page: 'gene' }) : openGene(fbn1)))),
    h('div', { class: 'guide-cols' },
      h('div', {},
        h('h3', {}, 'Everything is linked'),
        h('ul', {},
          h('li', {}, h('b', {}, 'Filters'), ' on the left apply to every page.'),
          h('li', {}, 'Click a ', h('b', {}, 'specialty row'), ' or a column of overlap dots to scope the disease list.'),
          h('li', {}, h('b', {}, 'Tick diseases'), ' in the list to compare their signs.'),
          h('li', {}, 'Click any ', h('b', {}, 'gene symbol'), ' or ', h('b', {}, 'disease name'), ' to open it.'),
          h('li', {}, 'The ', h('b', {}, 'Selection'), ' bar shows what is selected; × clears it. The browser’s Back button works, and the address can be shared.'))),
      h('div', {},
        h('h3', {}, 'Reading the colours'),
        h('ul', { class: 'keys' },
          h('li', {}, swatches([ACCENT]), h('span', {}, h('b', {}, 'Orange'), ' marks what you selected.')),
          h('li', {}, swatches(FREQ_COLOR.slice(1)), h('span', {}, h('b', {}, 'Blue'), ` is how often patients show a sign, from ${FREQ_SHORT[1].toLowerCase()} to ${FREQ_SHORT[5].toLowerCase()}.`)),
          h('li', {}, swatches(PREV_COLOR), h('span', {}, h('b', {}, 'Purple to yellow'), ' is the prevalence class, from rarest to most common.')),
          h('li', {}, swatches([PREV_UNKNOWN, PREV_NONE]), h('span', {}, h('b', {}, 'Grey'), ' is missing data. It never means zero.'))))),
    h('p', { class: 'guide-foot' }, 'Tip: press ', h('kbd', {}, '/'), ' to jump to the search box.'),
  ));
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  return dialog;
}

/** The strip above each page: what is currently selected, and how to undo it. */
function renderActive() {
  const el = refs.active;
  el.innerHTML = '';
  const chip = (kind, label, onRemove, onClick) =>
    h('span', { class: 'chip sel' },
      h('button', { class: 'chip-main', title: 'Go to this selection', onclick: onClick }, icon(kind, 14), label),
      h('button', { class: 'chip-x', title: 'Clear', 'aria-label': `Clear ${label}`, onclick: onRemove }, icon('x', 12)));

  const items = [];
  if (state.specialties.length) {
    const names = state.specialties.map((s) => D.specialties[s].label);
    const label = state.specMode === 'exact' ? `Exactly in: ${names.join(' + ')}` : `Specialty: ${names.join(', ')}`;
    items.push(chip('layers', label, () => update({ specialties: [] }), () => update({ page: 'overview' })));
  }
  if (state.focus !== null) {
    const d = D.diseases[state.focus];
    items.push(chip('disease', `Disease: ${d.name}`, () => update({ focus: null, compare: [] }), () => update({ page: 'disease' })));
  }
  if (state.compare.length) {
    items.push(chip('compare', `Comparing ${state.compare.length + (state.focus !== null ? 1 : 0)} diseases`, () => update({ compare: [] }), () => update({ page: 'disease' })));
  }
  if (state.gene !== null) {
    items.push(chip('gene', `Gene: ${D.genes[state.gene].symbol}`, () => update({ gene: null }), () => update({ page: 'gene' })));
  }
  el.append(h('span', { class: 'active-label' }, 'Selection'));
  if (items.length) el.append(...items);
  else el.append(h('span', { class: 'muted' }, 'Nothing selected yet. Click a specialty, a disease or a gene.'));
  if (items.length > 1) {
    el.append(h('button', { class: 'link small', onclick: () => update({ specialties: [], focus: null, compare: [], gene: null }) }, 'Clear all'));
  }
  el.append(
    h('span', { class: 'spacer' }),
    h('span', { class: 'match-pill' }, h('b', {}, fmt(getMatching().length)), ' entries match the filters'),
  );
}

// ------------------------------------------------------------ URL <-> state

// The "view" is what the Back button should step through: the page and the
// disease or gene it shows. Other changes only rewrite the current entry.
const viewKey = () => `${state.page}:${state.page === 'disease' ? state.focus : state.page === 'gene' ? state.gene : ''}`;
let lastView = null;
let restoring = false;

function syncUrl() {
  const hash = `#${encodeState(state)}`;
  const view = viewKey();
  if (location.hash !== hash) {
    const push = !restoring && lastView !== null && view !== lastView;
    history[push ? 'pushState' : 'replaceState'](null, '', hash);
  }
  const changed = view !== lastView;
  lastView = view;
  return changed;
}

function readUrl() {
  if (`#${encodeState(state)}` === location.hash) return;
  restoring = true;
  update(decodeState(location.hash));
  restoring = false;
}

// ------------------------------------------------------------------- render

function render() {
  hideTip();
  refs.tabs.forEach((t, i) => {
    const on = PAGES[i].id === state.page;
    t.classList.toggle('active', on);
    if (on) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  const newView = syncUrl();
  syncFilters();
  renderActive();
  const scroll = window.scrollY;
  refs.page.innerHTML = '';
  refs.page.classList.remove('enter');
  PAGES.find((p) => p.id === state.page).render(refs.page);
  if (newView) {
    // a new page, disease or gene: start at the top and fade the panels in
    void refs.page.offsetWidth;
    refs.page.classList.add('enter');
    window.scrollTo(0, 0);
  } else {
    window.scrollTo(0, scroll);
  }
}

loadData()
  .then(() => {
    Object.assign(state, decodeState(location.hash));
    buildShell();
    subscribe(render);
    render();
    window.addEventListener('popstate', readUrl);
    window.addEventListener('hashchange', readUrl);
    window.addEventListener('keydown', (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !refs.guide.open) {
        e.preventDefault();
        refs.search.focus();
      }
    });
    let timer;
    let width = window.innerWidth;
    window.addEventListener('resize', () => {
      if (window.innerWidth === width) return; // charts depend on the width only
      width = window.innerWidth;
      clearTimeout(timer);
      timer = setTimeout(render, 150);
    });
  })
  .catch((err) => {
    app.innerHTML = '';
    app.append(h('div', { class: 'loading' }, h('p', {}, `Could not load the data: ${err.message}`), h('button', { class: 'btn', onclick: () => location.reload() }, 'Try again')));
    console.error(err);
  });
