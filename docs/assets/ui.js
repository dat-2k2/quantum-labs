// Minimal DOM helpers for lab controls.

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) e.append(c);
  return e;
}

const field = (label, ...body) => el('div', { class: 'field' }, el('div', { class: 'field-label' }, label), ...body);

export function slider(label, { min, max, step = 1, value, format = (v) => v, onInput }) {
  const out = el('span', { class: 'field-value' }, format(value));
  const input = el('input', { type: 'range', min, max, step, value });
  const paint = () => input.style.setProperty('--p', `${((input.value - min) / (max - min)) * 100}%`);
  paint();
  input.addEventListener('input', () => { const v = Number(input.value); out.textContent = format(v); paint(); onInput(v); });
  const f = el('div', { class: 'field' }, el('div', { class: 'field-head' }, el('span', { class: 'field-label' }, label), out), input);
  f.set = (v) => { input.value = v; out.textContent = format(v); paint(); };
  return f;
}

// Bit toggles, displayed most-significant bit first. value is an integer.
export function bits(label, { n, value, onChange, hint = 'click to flip' }) {
  const row = el('div', { class: 'bits' });
  for (let i = n - 1; i >= 0; i--) {
    const on = (value >> i) & 1;
    row.append(el('button', {
      class: 'bit' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false',
      'aria-label': `bit ${i}`, onclick: () => onChange(value ^ (1 << i)),
    }, String(on)));
  }
  return field(el('span', {}, label, hint ? el('span', { class: 'hint' }, `  (${hint})`) : null), row);
}

export function segmented(label, { options, value, onChange }) {
  const seg = el('div', { class: 'seg', role: 'radiogroup' });
  for (const o of options) {
    const [v, text] = Array.isArray(o) ? o : [o, String(o)];
    seg.append(el('button', {
      type: 'button', role: 'radio', 'aria-checked': v === value ? 'true' : 'false',
      class: v === value ? 'on' : '', onclick: () => onChange(v),
    }, text));
  }
  return label ? field(label, seg) : seg;
}

export function toggle(label, { value, onChange }) {
  const input = el('input', { type: 'checkbox', checked: value });
  input.addEventListener('change', () => onChange(input.checked));
  return el('label', { class: 'switch' }, input, el('span', { class: 'switch-track' }), el('span', {}, label));
}

export function button(text, onClick, variant = 'primary') {
  return el('button', { type: 'button', class: `btn btn-${variant}`, onclick: onClick }, text);
}

export const shotsControl = (value, onChange) =>
  segmented('Shots', { options: [[100, '100'], [1000, '1 000'], [10000, '10 000']], value, onChange });

export function verdict(label, main, sub, tone = 'ok') {
  return el('div', { class: `verdict verdict-${tone}` },
    el('div', { class: 'field-label' }, label),
    el('div', { class: 'verdict-main' }, main),
    sub ? el('div', { class: 'verdict-sub' }, sub) : null);
}
