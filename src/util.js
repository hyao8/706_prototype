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

// ------------------------------------------------------------------ tooltip
let tip;

export function showTip(event, html) {
  if (!tip) {
    tip = h('div', { class: 'tooltip' });
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

// ------------------------------------------------------------- autocomplete

/**
 * Turn an <input> into a search box with a dropdown.
 * search(query) returns [{ label, sub, group, pick() }].
 */
export function autocomplete(input, search) {
  const wrap = h('div', { class: 'ac' });
  const list = h('div', { class: 'ac-list' });
  input.replaceWith(wrap);
  wrap.append(input, list);
  let items = [];
  let active = 0;

  const close = () => {
    list.style.display = 'none';
  };
  const pick = (item) => {
    input.value = '';
    close();
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
          onmousedown: (e) => {
            e.preventDefault();
            pick(item);
          },
        }, h('span', { class: 'ac-label' }, item.label), item.sub ? h('span', { class: 'ac-sub' }, item.sub) : null),
      );
    });
    list.style.display = 'block';
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
// Frequency classes: one blue ramp, light (very rare) to dark (obligate).
export const FREQ_COLOR = ['#ffffff', '#dbe9f6', '#a9cde6', '#63a6d3', '#2b7cba', '#0b4d92'];
// Prevalence classes: viridis, dark (rarest) to yellow (most common).
export const PREV_COLOR = ['#440154', '#414487', '#2a788e', '#22a884', '#7ad151', '#fde725'];
export const PREV_UNKNOWN = '#bdbdbd';
export const PREV_NONE = '#ececec';
export const prevColor = (pc) => (pc === -2 ? PREV_NONE : pc === -1 ? PREV_UNKNOWN : PREV_COLOR[pc]);
