// Small DOM helpers shared by the views.

/** Create an element: h('div', { class: 'x', onclick: fn }, child, 'text', ...) */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export const fmt = (n) => n.toLocaleString('en-US');
export const pct = (x) => `${(x * 100).toFixed(x < 0.1 && x > 0 ? 1 : 0)}%`;

// -------------------------------------------------------------------- icons
// Line icons on a 24 px grid, drawn with the current text colour.
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  overview: '<path d="M3 20h18"/><path d="M6.5 20v-8M12 20V5M17.5 20v-11"/>',
  disease: '<path d="M3 12h4l2.5-7 5 14 2.5-7h4"/>',
  gene: '<path d="M7 3c0 5 10 5 10 9s-10 4-10 9"/><path d="M17 3c0 5-10 5-10 9s10 4 10 9"/><path d="M8.6 6.5h6.8M8.6 17.5h6.8"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8"/><path d="M12 17h.01"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5a3.2 3.2 0 0 1 0 6M17.5 14.3c2 .8 3.5 2.9 3.5 5.7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  inherit: '<circle cx="6" cy="5" r="2"/><circle cx="18" cy="5" r="2"/><circle cx="12" cy="19" r="2"/><path d="M6 7v3a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7M12 12v5"/>',
  signs: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="m9 13 2 2 4-4"/>',
  reset: '<path d="M4 4v6h6"/><path d="M4.6 10A8 8 0 1 1 6 17.3"/>',
  compare: '<rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5h.01"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16v4M17 18h4"/>',
  link: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.9 7.6-3.8M8.2 13.1l7.6 3.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  database: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
};

export function icon(name, size = 16) {
  return h('span', {
    class: `icon icon-${name}`,
    'aria-hidden': 'true',
    html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`,
  });
}

/** The app mark: one gene (orange) linked to two diseases. Also used as the favicon. */
export function logo(size = 28) {
  return h('span', {
    class: 'logo',
    'aria-hidden': 'true',
    html: `<svg viewBox="0 0 32 32" width="${size}" height="${size}"><rect width="32" height="32" rx="9" fill="#fff" fill-opacity=".12"/><path d="M11 16 21 9.5M11 16l10 6.5" stroke="#fff" stroke-opacity=".75" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="21" cy="9.5" r="3.4" fill="#fff"/><circle cx="21" cy="22.5" r="3.4" fill="#fff"/><circle cx="10.5" cy="16" r="4.4" fill="#ff8a3d"/></svg>`,
  });
}

// ------------------------------------------------------------ chart shapes

/** Width available to a chart inside a full-width panel (main and panel padding removed). */
export function chartWidth(min = 880) {
  return Math.max(min, (document.querySelector('main')?.clientWidth || 1180) - 84);
}

/** Horizontal bar: square at the baseline (left), rounded at the data end. */
export function hbar(x, y, w, hgt, r = 3) {
  if (!(w > 0)) return '';
  const rr = Math.min(r, w, hgt / 2);
  return `M${x},${y}h${w - rr}a${rr},${rr} 0 0 1 ${rr},${rr}v${hgt - 2 * rr}a${rr},${rr} 0 0 1 ${-rr},${rr}h${-(w - rr)}z`;
}

/** Column: square at the baseline (bottom), rounded at the top. */
export function vbar(x, yTop, w, hgt, r = 3) {
  if (!(hgt > 0)) return '';
  const rr = Math.min(r, hgt, w / 2);
  return `M${x},${yTop + hgt}v${-(hgt - rr)}a${rr},${rr} 0 0 1 ${rr},${-rr}h${w - 2 * rr}a${rr},${rr} 0 0 1 ${rr},${rr}v${hgt - rr}z`;
}

// ------------------------------------------------------------------ tooltip
let tip;

export function showTip(event, html) {
  if (!tip) {
    tip = h('div', { class: 'tooltip', role: 'tooltip' });
    document.body.append(tip);
  }
  tip.innerHTML = html;
  tip.style.display = 'block';
  const pad = 14;
  const { innerWidth: w, innerHeight: hgt } = window;
  const r = tip.getBoundingClientRect();
  let x = event.clientX + pad;
  let y = event.clientY + pad;
  if (x + r.width > w - 8) x = event.clientX - r.width - pad;
  if (y + r.height > hgt - 8) y = event.clientY - r.height - pad;
  tip.style.left = `${Math.max(4, x)}px`;
  tip.style.top = `${Math.max(4, y)}px`;
}

export function hideTip() {
  if (tip) tip.style.display = 'none';
}

/** Attach a tooltip to a d3 selection; html may be a function of the datum. */
export function withTip(selection, html) {
  return selection
    .on('mousemove.tip', (event, d) => showTip(event, typeof html === 'function' ? html(d) : html))
    .on('mouseleave.tip', hideTip);
}

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** A swatch + label line for tooltips. */
export const tipKey = (color, extra = '') => `<i class="tip-key" style="background:${color};${extra}"></i>`;

// ------------------------------------------------------------- autocomplete

/**
 * Turn an <input> into a search box with a dropdown.
 * search(query) returns [{ label, sub, group, pick() }].
 * opts.icon adds a leading icon; opts.hint adds a trailing key hint;
 * opts.blur leaves the box after a pick (for a search that navigates away).
 */
export function autocomplete(input, search, opts = {}) {
  const wrap = h('div', { class: `ac${opts.icon ? ' has-icon' : ''}` });
  const list = h('div', { class: 'ac-list', role: 'listbox' });
  input.replaceWith(wrap);
  if (opts.icon) wrap.append(icon(opts.icon, 16));
  wrap.append(input);
  if (opts.hint) wrap.append(h('kbd', { class: 'ac-hint' }, opts.hint));
  wrap.append(list);
  input.setAttribute('autocomplete', 'off');
  let items = [];
  let active = 0;

  const close = () => {
    list.style.display = 'none';
  };
  const pick = (item) => {
    input.value = '';
    close();
    if (opts.blur) input.blur();
    item.pick();
  };
  const draw = () => {
    list.innerHTML = '';
    if (!items.length) {
      if (input.value.trim()) list.append(h('div', { class: 'ac-empty' }, 'No match'));
      else return close();
    }
    let group = null;
    items.forEach((item, i) => {
      if (item.group && item.group !== group) {
        group = item.group;
        list.append(h('div', { class: 'ac-group' }, group));
      }
      list.append(
        h('div', {
          class: `ac-item${i === active ? ' active' : ''}`,
          role: 'option',
          onmousedown: (e) => {
            e.preventDefault();
            pick(item);
          },
        }, h('span', { class: 'ac-label' }, item.label), item.sub ? h('span', { class: 'ac-sub' }, item.sub) : null),
      );
    });
    list.style.display = 'block';
    list.querySelector('.ac-item.active')?.scrollIntoView({ block: 'nearest' });
  };

  input.addEventListener('input', () => {
    items = search(input.value);
    active = 0;
    draw();
  });
  input.addEventListener('focus', () => {
    if (input.value.trim()) {
      items = search(input.value);
      draw();
    }
  });
  input.addEventListener('blur', close);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length) active = (active + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
      draw();
    } else if (e.key === 'Enter' && items[active]) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === 'Escape') {
      close();
      input.blur();
    }
  });
  return wrap;
}

// Shared colour scales ------------------------------------------------------
// Colour is kept for data: selection (orange), sign frequency (one blue ramp)
// and prevalence class (viridis). Everything else is neutral.
export const ACCENT = '#e8590c';
export const MARK = '#43639c';
export const MARK_SOFT = '#d6e3f5';
// Frequency classes, light (very rare) to dark (obligate). Index 0 = excluded.
// The lightest step still stands off a white cell, so "very rare" never reads
// as "not annotated".
export const FREQ_COLOR = ['#ffffff', '#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#0d366b'];
// Prevalence classes: viridis, dark (rarest) to yellow (most common).
export const PREV_COLOR = ['#440154', '#414487', '#2a788e', '#22a884', '#7ad151', '#fde725'];
// Two greys for the two kinds of missing prevalence.
export const PREV_UNKNOWN = '#a3abbb';
export const PREV_NONE = '#dcdfe7';
export const prevColor = (pc) => (pc === -2 ? PREV_NONE : pc === -1 ? PREV_UNKNOWN : PREV_COLOR[pc]);
