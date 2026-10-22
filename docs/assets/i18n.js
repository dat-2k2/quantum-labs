// Tiny i18n layer. English strings live in the code and double as lookup keys;
// other languages map those keys to translations. Placeholders look like {name}.

import { VI } from './i18n.vi.js';

const KEY = 'ql-lang';
const SUPPORTED = ['en', 'vi'];
const DICTS = { vi: VI.ui };

function detect() {
  const q = new URLSearchParams(location.search).get('lang');
  if (SUPPORTED.includes(q)) { try { localStorage.setItem(KEY, q); } catch { /* storage unavailable */ } return q; }
  try { const s = localStorage.getItem(KEY); if (SUPPORTED.includes(s)) return s; } catch { /* storage unavailable */ }
  return (navigator.language || '').toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

export const lang = detect();

export function t(s, vars = {}) {
  const str = DICTS[lang]?.[s] ?? s;
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

export function setLang(next) {
  try { localStorage.setItem(KEY, next); } catch { /* storage unavailable: ?lang= carries the choice */ }
  const u = new URL(location.href);
  u.searchParams.set('lang', next);
  location.href = u.href;
}

// Translate static markup: elements with data-i18n use their own HTML as the key;
// data-i18n-attr lists attributes (e.g. "aria-label,title") translated the same way.
export function translateDom(root = document) {
  document.documentElement.lang = lang;
  if (lang === 'en') return;
  root.querySelectorAll('[data-i18n]').forEach((node) => { node.innerHTML = t(node.innerHTML.trim()); });
  root.querySelectorAll('[data-i18n-attr]').forEach((node) => {
    for (const a of node.dataset.i18nAttr.split(',')) if (node.hasAttribute(a)) node.setAttribute(a, t(node.getAttribute(a)));
  });
}
