// Keeps the shared state in the URL hash, so that a view can be bookmarked or
// shared and the browser's Back button returns to the previous view.
//
//   #disease?d=558&cmp=284963&signs=0001166,0001083&minfreq=4
//
// Stable identifiers are used (ORPHAcodes, HPO ids, gene symbols), so a link
// keeps working when the data file is rebuilt.
import { D } from './data.js';
import { defaults } from './state.js';

const PAGES = ['overview', 'disease', 'gene'];

export function encodeState(s) {
  const def = defaults();
  const parts = [];
  const put = (key, values) => parts.push(`${key}=${[].concat(values).map((v) => encodeURIComponent(v)).join(',')}`);

  if (s.focus !== null) put('d', D.diseases[s.focus].code);
  if (s.compare.length) put('cmp', s.compare.map((i) => D.diseases[i].code));
  if (s.gene !== null) put('gene', D.genes[s.gene].symbol);
  if (s.signs.length) put('signs', s.signs.map((i) => D.signs[i].id.replace('HP:', '')));
  if (s.minFreq !== def.minFreq) put('minfreq', s.minFreq);
  if (s.levels.join() !== def.levels.join()) put('levels', s.levels);
  if (s.onset.length) put('onset', s.onset);
  if (s.inheritance.length) put('inh', s.inheritance);
  if (s.prevClass.length) put('prev', s.prevClass);
  const need = Object.keys(s.need).filter((k) => s.need[k]);
  if (need.length) put('need', need);
  if (s.specialties.length) put('spec', s.specialties);
  if (s.specMode !== def.specMode) put('specmode', s.specMode);
  if (s.countBy !== def.countBy) put('count', s.countBy);

  return parts.length ? `${s.page}?${parts.join('&')}` : s.page;
}

/** Parse a location hash into a complete state object; anything invalid is ignored. */
export function decodeState(hash) {
  const s = defaults();
  const [page, query = ''] = hash.replace(/^#/, '').split('?');
  if (PAGES.includes(page)) s.page = page;

  const q = new Map(query.split('&').filter(Boolean).map((kv) => {
    const i = kv.indexOf('=');
    return i < 0 ? [kv, ''] : [kv.slice(0, i), kv.slice(i + 1)];
  }));
  const items = (key) => (q.get(key) || '').split(',').filter(Boolean).map((v) => {
    try {
      return decodeURIComponent(v);
    } catch {
      return '';
    }
  });
  const unique = (list) => [...new Set(list)];
  const nums = (key, lo, hi) => unique(items(key).map(Number).filter((n) => Number.isInteger(n) && n >= lo && n <= hi));
  const found = (list) => unique(list.filter((x) => x !== undefined));

  if (q.has('signs')) s.signs = found(items('signs').map((id) => D.signById.get(`HP:${id}`)));
  const [minFreq] = nums('minfreq', 1, 5);
  if (minFreq !== undefined) s.minFreq = minFreq;
  if (q.has('levels')) s.levels = nums('levels', 0, 2);
  if (q.has('onset')) s.onset = nums('onset', 0, D.vocab.onset.length - 1);
  if (q.has('inh')) s.inheritance = nums('inh', 0, D.vocab.inheritance.length - 1);
  if (q.has('prev')) s.prevClass = nums('prev', -2, 5);
  for (const key of items('need')) if (key in s.need) s.need[key] = true;
  if (q.has('spec')) s.specialties = nums('spec', 0, D.specialties.length - 1);
  if (q.get('specmode') === 'exact') s.specMode = 'exact';
  if (q.get('count') === 'all') s.countBy = 'all';

  const focus = D.diseaseByCode.get(Number(q.get('d')));
  if (focus !== undefined) {
    s.focus = focus;
    s.compare = found(items('cmp').map((code) => D.diseaseByCode.get(Number(code)))).filter((i) => i !== focus);
  }
  const gene = D.geneBySymbol.get(items('gene')[0]);
  if (gene !== undefined) s.gene = gene;
  return s;
}
