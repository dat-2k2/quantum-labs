// SVG / HTML renderers: circuits, histograms, amplitude bars, Bloch spheres, line charts.

import { t, lang } from './i18n.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Circuit diagram ----------
const GLYPH = { SDG: 'S†', TDG: 'T†', M: '', INIT: '' };
const ROW = 46, GATE = 34, PAD = 14, LABEL_W = 46;

export function opLabel(op) {
  if (op.label != null) return op.label;
  if (op.g in GLYPH) return GLYPH[op.g];
  if (op.g === 'P' || op.g === 'RY') return `${op.g}`;
  return op.g;
}

const textWidth = (s) => [...String(s)].length * 7.6 + 16;

function wiresOf(op, n) {
  if (op.g === 'BARRIER') return [...Array(n).keys()];
  return [...op.t, ...(op.c || [])];
}

function flatten(ops, expand) {
  const out = [];
  for (const op of ops) {
    if (op.g === 'BLOCK' && expand) out.push(...flatten(op.ops, expand));
    else out.push(op);
  }
  return out;
}

// Group ops into drawing columns: an op goes into the first column after every wire it spans is free.
export function layoutCircuit(ops, n, expand = false) {
  const flat = flatten(ops, expand);
  const level = new Array(n).fill(0);
  const cols = []; // { ops: [], w }
  for (const op of flat) {
    const ws = wiresOf(op, n);
    const lo = Math.min(...ws), hi = Math.max(...ws);
    let col = 0;
    for (let q = lo; q <= hi; q++) col = Math.max(col, level[q]);
    for (let q = lo; q <= hi; q++) level[q] = col + 1;
    cols[col] ??= { ops: [], w: GATE };
    cols[col].ops.push(op);
    const isBig = op.g === 'BLOCK' || op.g === 'PERM' || op.g === 'ORACLE';
    const w = op.g === 'BARRIER' ? 10 : op.g === 'SWAP' || (op.g === 'X' && op.c?.length) || (op.g === 'Z' && op.c?.length) ? GATE
      : Math.max(GATE, textWidth(opLabel(op)) + (isBig ? 12 : 0));
    cols[col].w = Math.max(cols[col].w, w);
  }
  return cols;
}

// Each column is drawn in its own <g data-col> with a highlight band, so a step-through player can mark progress.
export function drawCircuit(ops, n, { expand = false, wireLabels } = {}) {
  const cols = layoutCircuit(ops, n, expand);
  let x = LABEL_W + PAD;
  const xs = cols.map((c) => { const cx = x + c.w / 2; x += c.w + PAD; return cx; });
  const width = Math.max(x + PAD, 240);
  const height = n * ROW + 8;
  const y = (q) => 4 + ROW / 2 + q * ROW;

  let s = `<svg class="circuit" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
  cols.forEach((col, ci) => {
    s += `<rect class="c-band" data-col="${ci}" x="${xs[ci] - col.w / 2 - PAD / 2}" y="2" width="${col.w + PAD}" height="${height - 4}" rx="8"/>`;
  });
  for (let q = 0; q < n; q++) {
    const lbl = wireLabels?.[q] ?? `q${q}`;
    s += `<text class="c-wlabel" x="4" y="${y(q) + 4}">${esc(lbl)}</text>`;
    s += `<line class="c-wire" x1="${LABEL_W}" y1="${y(q)}" x2="${width - 6}" y2="${y(q)}"/>`;
  }
  cols.forEach((col, ci) => {
    s += `<g class="c-col" data-col="${ci}">`;
    for (const op of col.ops) s += drawOp(op, xs[ci], col.w, y, n);
    s += '</g>';
  });
  return s + '</svg>';
}

function box(cx, cy, w, h, label, cls) {
  return `<rect class="${cls}" x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="8"/>`
    + (label ? `<text class="c-glabel ${cls}-t" x="${cx}" y="${cy + 5}" text-anchor="middle">${esc(label)}</text>` : '');
}

function drawOp(op, cx, colW, y, n) {
  let s = '';
  const c = op.c || [];
  const all = wiresOf(op, n);
  const lo = Math.min(...all), hi = Math.max(...all);
  if (op.g === 'BARRIER') {
    return `<line class="c-barrier" x1="${cx}" y1="${y(0) - ROW / 2 + 4}" x2="${cx}" y2="${y(n - 1) + ROW / 2 - 4}"/>`;
  }
  if (c.length || op.g === 'SWAP') s += `<line class="c-ctrl-line" x1="${cx}" y1="${y(lo)}" x2="${cx}" y2="${y(hi)}"/>`;
  for (const q of c) s += `<circle class="c-ctrl" cx="${cx}" cy="${y(q)}" r="5.5"/>`;

  const isBig = op.g === 'BLOCK' || op.g === 'PERM' || op.g === 'ORACLE';
  if (isBig) {
    const tlo = Math.min(...op.t), thi = Math.max(...op.t);
    const top = y(tlo) - GATE / 2, h = y(thi) - y(tlo) + GATE, w = colW;
    s += `<rect class="c-block${op.err ? ' c-err' : ''}" x="${cx - w / 2}" y="${top}" width="${w}" height="${h}" rx="10"/>`;
    s += `<text class="c-glabel c-block-t" x="${cx}" y="${top + h / 2 + 5}" text-anchor="middle">${esc(opLabel(op))}</text>`;
    return s;
  }
  const tq = op.t[0];
  if (op.g === 'SWAP') {
    for (const q of op.t) s += `<path class="c-swap" d="M${cx - 7} ${y(q) - 7}l14 14M${cx + 7} ${y(q) - 7}l-14 14"/>`;
    return s;
  }
  if (op.g === 'X' && c.length) {
    return s + `<circle class="c-target" cx="${cx}" cy="${y(tq)}" r="13"/><path class="c-target-x" d="M${cx} ${y(tq) - 13}v26M${cx - 13} ${y(tq)}h26"/>`;
  }
  if (op.g === 'Z' && c.length) return s + `<circle class="c-ctrl" cx="${cx}" cy="${y(tq)}" r="5.5"/>`;
  if (op.g === 'M') {
    s += box(cx, y(tq), GATE, GATE, '', 'c-meas');
    s += `<path class="c-meas-icon" d="M${cx - 9} ${y(tq) + 6}a9 9 0 0 1 18 0M${cx} ${y(tq) + 6}l6 -9"/>`;
    return s;
  }
  const w = Math.max(GATE, textWidth(opLabel(op)));
  const cls = op.err ? 'c-err' : op.g === 'INIT' ? 'c-init' : 'c-gate';
  return s + box(cx, y(tq), w, GATE, opLabel(op), cls);
}

// ---------- Histogram (horizontal bars) ----------
export function histogram(counts, { total, highlight = () => false, sort = 'count', limit = 16, label = (k) => k, note } = {}) {
  let entries = [...counts.entries()];
  const sum = total ?? entries.reduce((a, [, v]) => a + v, 0);
  if (sort === 'count') entries.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  else entries.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const hidden = entries.length - limit;
  entries = entries.slice(0, limit);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  let h = '<div class="hist">';
  for (const [k, v] of entries) {
    const hi = highlight(k);
    h += `<div class="hist-row${hi ? ' hi' : ''}"><span class="hist-k">${esc(label(k))}</span>`
      + `<span class="hist-bar"><span style="width:${(100 * v) / max}%"></span></span>`
      + `<span class="hist-v">${v}</span></div>`;
  }
  if (hidden > 0) h += `<div class="hist-more">${esc(t('+ {n} more outcomes', { n: hidden }))}</div>`;
  if (note) h += `<div class="hist-more">${esc(note)}</div>`;
  return h + `</div><div class="hist-total">${esc(t('{n} shots', { n: sum.toLocaleString(lang) }))}</div>`;
}

// ---------- Vertical amplitude bars ----------
// items: [{ label, value (signed), marked }]
export function ampBars(items, { height = 170, signed = true, yMax } = {}) {
  const n = items.length;
  const W = Math.max(320, n * 14), H = height;
  const max = yMax ?? Math.max(...items.map((i) => Math.abs(i.value)), 1e-9);
  const mid = signed ? H / 2 : H - 18;
  const scale = (signed ? H / 2 - 12 : H - 30) / max;
  const bw = (W - 20) / n;
  let s = `<svg class="ampbars" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">`;
  s += `<line class="axis" x1="10" x2="${W - 10}" y1="${mid}" y2="${mid}"/>`;
  items.forEach((it, i) => {
    const h = Math.abs(it.value) * scale;
    const x = 10 + i * bw + bw * 0.15;
    const yTop = it.value >= 0 ? mid - h : mid;
    s += `<rect class="${it.marked ? 'bar-hi' : 'bar'}" x="${x}" y="${yTop}" width="${bw * 0.7}" height="${Math.max(h, 0.5)}" rx="2"><title>${esc(it.label)}: ${it.value.toFixed(3)}</title></rect>`;
  });
  return s + '</svg>';
}

// ---------- Phase wheels (complex amplitudes) ----------
export function phaseWheels(amps, n) {
  let h = '<div class="wheels">';
  amps.forEach(([re, im], i) => {
    const r = Math.hypot(re, im), ang = Math.atan2(im, re);
    const R = 18, L = Math.min(1, r * Math.sqrt(amps.length)) * R;
    const hue = ((ang * 180) / Math.PI + 360) % 360;
    h += `<div class="wheel" title="|${i.toString(2).padStart(n, '0')}⟩ amp ${r.toFixed(3)} ∠${((ang * 180) / Math.PI).toFixed(0)}°">`
      + `<svg viewBox="-22 -22 44 44"><circle r="${R}" class="wheel-ring"/>`
      + `<circle r="${(r * Math.sqrt(amps.length) * R).toFixed(2)}" class="wheel-fill" style="fill:hsl(${hue} 80% 65% / .18)"/>`
      + (r > 1e-9 ? `<line x1="0" y1="0" x2="${(L * Math.cos(ang)).toFixed(2)}" y2="${(-L * Math.sin(ang)).toFixed(2)}" style="stroke:hsl(${hue} 80% 70%)" class="wheel-hand"/>` : '')
      + `</svg><span>${i.toString(2).padStart(n, '0')}</span></div>`;
  });
  return h + '</div>';
}

// ---------- Bloch sphere ----------
export function bloch({ x, y, z }, { label = '|ψ⟩', size = 200, accent = 'var(--cyan)' } = {}) {
  const R = size / 2 - 22, c = size / 2;
  // oblique projection: x axis points toward the viewer (down-left), y to the right, z up
  const px = (vx, vy, vz) => [c + vy * R - vx * R * 0.38, c - vz * R + vx * R * 0.24];
  const [ex, ey] = px(x, y, z);
  const len = Math.hypot(x, y, z);
  return `<svg class="bloch" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">`
    + `<circle cx="${c}" cy="${c}" r="${R}" class="b-sphere"/>`
    + `<ellipse cx="${c}" cy="${c}" rx="${R}" ry="${R * 0.28}" class="b-eq"/>`
    + `<line x1="${c}" y1="${c - R}" x2="${c}" y2="${c + R}" class="b-axis"/>`
    + `<line x1="${c - R}" y1="${c}" x2="${c + R}" y2="${c}" class="b-axis"/>`
    + `<text x="${c}" y="${c - R - 6}" text-anchor="middle" class="b-lbl">|0⟩</text>`
    + `<text x="${c}" y="${c + R + 16}" text-anchor="middle" class="b-lbl">|1⟩</text>`
    + `<line x1="${c}" y1="${c}" x2="${ex}" y2="${ey}" style="stroke:${accent}" class="b-vec" stroke-opacity="${0.35 + 0.65 * len}"/>`
    + `<circle cx="${ex}" cy="${ey}" r="6" style="fill:${accent}"/>`
    + `<circle cx="${ex}" cy="${ey}" r="14" style="fill:${accent}" fill-opacity=".15"/>`
    + `<circle cx="${c}" cy="${c}" r="3" class="b-origin"/>`
    + `<text x="${Math.min(ex + 12, size - 30)}" y="${ey - 10}" class="b-lbl" style="fill:${accent}">${esc(label)}</text>`
    + '</svg>';
}

// ---------- Line chart ----------
export function lineChart(series, { xLabel = '', yLabel = '', xMax, yMax, width = 560, height = 300 } = {}) {
  const L = 52, B = 40, T = 14, Rm = 16;
  const pts = series.flatMap((s) => s.pts);
  const xm = xMax ?? Math.max(...pts.map((p) => p[0]), 1e-9);
  const ym = yMax ?? Math.max(...pts.map((p) => p[1]), 1e-9);
  const X = (v) => L + (v / xm) * (width - L - Rm);
  const Y = (v) => height - B - (v / ym) * (height - B - T);
  let s = `<svg class="linechart" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  for (let i = 0; i <= 4; i++) {
    const yv = (ym * i) / 4, xv = (xm * i) / 4;
    s += `<line class="grid" x1="${L}" x2="${width - Rm}" y1="${Y(yv)}" y2="${Y(yv)}"/>`;
    s += `<text class="tick" x="${L - 8}" y="${Y(yv) + 4}" text-anchor="end">${yv.toFixed(2)}</text>`;
    s += `<text class="tick" x="${X(xv)}" y="${height - B + 18}" text-anchor="middle">${+xv.toFixed(3)}</text>`;
  }
  s += `<text class="axis-lbl" x="${(L + width) / 2}" y="${height - 4}" text-anchor="middle">${esc(xLabel)}</text>`;
  s += `<text class="axis-lbl" transform="translate(12 ${(height - B) / 2}) rotate(-90)" text-anchor="middle">${esc(yLabel)}</text>`;
  for (const se of series) {
    if (!se.pts.length) continue;
    const d = se.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('');
    s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="2.5" ${se.dash ? 'stroke-dasharray="6 5"' : ''}/>`;
    if (!se.dash) for (const p of se.pts) s += `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3.5" fill="${se.color}"/>`;
  }
  return s + '</svg>';
}
