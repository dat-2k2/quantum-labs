// Step-through player: runs a circuit one column at a time, keeps the state after every step,
// and plays it back — highlighting the current column, animating the amplitudes and one Bloch
// sphere per qubit. Speed is adjustable and remembered.

import { State, applyOp } from './sim.js';
import { opLabel, bloch } from './viz.js';
import { el } from './ui.js';
import { t } from './i18n.js';

const SPEEDS = [0.5, 1, 2, 4];
const STEP_MS = 1200;          // time per step at 1×
const MAX_ROWS = 12;           // amplitude rows shown at once
const MAX_SPHERES = 8;         // Bloch spheres shown at once
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let speed = (() => { try { return Number(localStorage.getItem('ql-speed')) || 1; } catch { return 1; } })();
if (!SPEEDS.includes(speed)) speed = 1;

// ---------- timeline ----------
// cols: [{ key, ops }] in circuit order. Returns frames: the state before any gate, then after each non-empty column.
export function timeline(n, cols, { init, wireLabels } = {}) {
  const s = init ? init.clone() : new State(n);
  const frames = [{ key: null, label: init ? t('Initial state') : t('Start: every qubit is |0⟩'), re: s.re.slice(), im: s.im.slice() }];
  for (const { key, ops } of cols) {
    const real = ops.filter((op) => op.g !== 'BARRIER');
    if (!real.length) continue;
    for (const op of real) applyOp(s, op);
    frames.push({ key, label: describe(real, wireLabels), measure: real.every((op) => op.g === 'M'), re: s.re.slice(), im: s.im.slice() });
  }
  return frames;
}

function describe(ops, wireLabels) {
  const q = (i) => wireLabels?.[i] ?? `q${i}`;
  const parts = [], merged = new Map();
  for (const op of ops) {
    const c = op.c || [];
    if (op.g === 'BLOCK' || op.g === 'PERM' || op.g === 'ORACLE') {
      const lo = Math.min(...op.t), hi = Math.max(...op.t);
      parts.push(`${opLabel(op)} · ${c.length ? c.map(q).join(',') + ' → ' : ''}${lo === hi ? q(lo) : `${q(lo)}–${q(hi)}`}`);
    } else if (op.g === 'SWAP') {
      parts.push(`SWAP · ${q(op.t[0])} ↔ ${q(op.t[1])}`);
    } else if (c.length) {
      const base = op.g === 'P' ? `P(${op.label ?? ''})` : op.label ?? op.g;
      parts.push(`${op.label && op.g !== 'P' ? base : 'C'.repeat(c.length) + base} · ${c.map(q).join(',')} → ${q(op.t[0])}`);
    } else {
      const name = op.g === 'M' ? 'M' : op.g === 'P' ? `P(${op.label ?? ''})` : opLabel(op) || op.g;
      if (!merged.has(name)) { merged.set(name, []); parts.push(name); }
      merged.get(name).push(q(op.t[0]));
    }
  }
  return parts.map((p) => (merged.has(p) ? `${p} · ${merged.get(p).join(', ')}` : p)).join('   ');
}

// Bloch vector of qubit k from stored amplitudes (reduced state, so entangled qubits get a short vector).
function blochAt(re, im, k) {
  const bit = 1 << k;
  let r00 = 0, r11 = 0, xr = 0, xi = 0;
  for (let i = 0; i < re.length; i++) {
    if (i & bit) continue;
    const j = i | bit;
    r00 += re[i] * re[i] + im[i] * im[i];
    r11 += re[j] * re[j] + im[j] * im[j];
    xr += re[i] * re[j] + im[i] * im[j];
    xi += im[i] * re[j] - re[i] * im[j];
  }
  return { x: 2 * xr, y: -2 * xi, z: r00 - r11 };
}

// ---------- icons ----------
const ICON = {
  start: 'M5 5h2.5v14H5zM19 5l-10 7 10 7z', back: 'M17 5l-9 7 9 7z', fwd: 'M7 5l9 7-9 7z', end: 'M16.5 5H19v14h-2.5zM5 5l10 7-10 7z',
  play: 'M7 4.5l12 7.5-12 7.5z', pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
};
const icon = (name) => el('span', { class: 'p-icon', 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="${ICON[name]}"/></svg>` });

// ---------- player ----------
export class Player {
  constructor(host) {
    this.host = host;
    this.frames = [];
    this.i = 0;
    this.timer = null;
    this.vecs = [];
    const btn = (name, label, onclick, cls = 'btn btn-secondary btn-sm p-btn') =>
      el('button', { type: 'button', class: cls, 'aria-label': label, title: label, onclick }, icon(name));
    this.playBtn = el('button', { type: 'button', class: 'btn btn-primary btn-sm p-play', onclick: () => this.toggle() });
    this.count = el('span', { class: 'p-count' });
    this.desc = el('span', { class: 'p-desc' });
    this.scrub = el('input', { type: 'range', class: 'p-scrub', min: 0, max: 0, value: 0, 'aria-label': t('Circuit progress') });
    this.scrub.addEventListener('input', () => { this.stop(); this.go(Number(this.scrub.value)); });
    const speeds = el('div', { class: 'seg p-speed', role: 'radiogroup', 'aria-label': t('Speed') }, ...SPEEDS.map((v) => el('button', {
      type: 'button', role: 'radio', 'data-speed': v, onclick: () => this.setSpeed(v),
    }, `${v}×`)));
    this.speedBtns = [...speeds.children];
    this.amps = el('div', { class: 'p-rows' });
    this.ampNote = el('p', { class: 'p-hint' });
    this.spheres = el('div', { class: 'p-spheres' });
    this.sphereNote = el('p', { class: 'p-hint' });
    this.measureNote = el('p', { class: 'p-measure', hidden: true }, t('Measurement: shown before collapse — each shot picks one outcome with these probabilities.'));
    host.replaceChildren(el('div', { class: 'player', tabindex: '-1' },
      el('div', { class: 'p-head' }, el('span', { class: 'field-label' }, t('Step through the circuit'))),
      el('div', { class: 'p-transport' },
        btn('start', t('Back to start'), () => { this.stop(); this.go(0); }),
        btn('back', t('Previous step'), () => { this.stop(); this.go(this.i - 1); }),
        this.playBtn,
        btn('fwd', t('Next step'), () => { this.stop(); this.go(this.i + 1); }),
        btn('end', t('Jump to end'), () => { this.stop(); this.go(this.frames.length - 1); }),
        el('div', { class: 'p-label', 'aria-live': 'polite' }, this.count, this.desc),
        el('div', { class: 'p-speedbox' }, el('span', { class: 'p-hint' }, t('Speed')), speeds)),
      this.scrub,
      this.measureNote,
      el('div', { class: 'p-state' },
        el('div', { class: 'p-amps' }, el('div', { class: 'field-label' }, t('Amplitudes')), this.amps, this.ampNote),
        el('div', { class: 'p-qubits' }, el('div', { class: 'field-label' }, t('Each qubit')), this.spheres, this.sphereNote))));
    host.firstChild.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); this.stop(); this.go(this.i + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.stop(); this.go(this.i - 1); }
      if (e.key === ' ' && e.target === host.firstChild) { e.preventDefault(); this.toggle(); }
    });
    this.paintSpeed();
    this.paintPlay();
  }

  // Load a new circuit. Keeps the position (clamped) unless asked to jump to the end.
  load({ n, cols, init, wireLabels, highlight }) {
    this.stop();
    this.n = n;
    this.wireLabels = wireLabels;
    this.highlight = highlight;
    this.frames = timeline(n, cols, { init, wireLabels });
    this.scrub.max = this.frames.length - 1;
    this.rowKeys = null;
    this.vecs = [];
    this.go(this.frames.length - 1, { instant: true });
  }

  setSpeed(v) {
    speed = v;
    try { localStorage.setItem('ql-speed', String(v)); } catch { /* storage unavailable */ }
    this.paintSpeed();
    if (this.timer) { this.stop(); this.play(); }
  }

  get stepMs() { return STEP_MS / speed; }

  toggle() { if (this.timer) this.stop(); else this.play(); }

  play() {
    if (this.frames.length < 2) return;
    if (this.i >= this.frames.length - 1) this.go(0);
    const tick = () => {
      if (this.i >= this.frames.length - 1) { this.stop(); return; }
      this.go(this.i + 1);
      this.timer = setTimeout(tick, this.stepMs);
    };
    this.timer = setTimeout(tick, Math.min(this.stepMs, 500));
    this.paintPlay();
  }

  stop() {
    clearTimeout(this.timer);
    this.timer = null;
    this.paintPlay();
  }

  go(i, { instant = false } = {}) {
    if (!this.frames.length) return;
    this.i = Math.max(0, Math.min(this.frames.length - 1, i));
    const f = this.frames[this.i];
    this.scrub.value = this.i;
    this.scrub.style.setProperty('--p', `${(100 * this.i) / Math.max(1, this.frames.length - 1)}%`);
    this.count.textContent = t('Step {i} / {n}', { i: this.i, n: this.frames.length - 1 });
    this.desc.textContent = f.label;
    this.measureNote.hidden = !f.measure;
    this.highlight?.(f.key);
    const ms = instant || reduceMotion() ? 0 : Math.min(this.stepMs * 0.7, 700);
    this.host.style.setProperty('--p-dur', `${ms}ms`);
    this.paintAmps(f);
    this.paintSpheres(f, ms);
  }

  paintPlay() {
    const playing = !!this.timer;
    this.playBtn.replaceChildren(icon(playing ? 'pause' : 'play'), el('span', {}, playing ? t('Pause') : t('Play')));
    this.playBtn.setAttribute('aria-pressed', String(playing));
  }

  paintSpeed() {
    for (const b of this.speedBtns) {
      const on = Number(b.dataset.speed) === speed;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    }
  }

  paintAmps(f) {
    const N = f.re.length, n = this.n;
    const prob = (i) => f.re[i] * f.re[i] + f.im[i] * f.im[i];
    let keys;
    if (N <= 16) keys = [...Array(N).keys()]; // up to 4 qubits: show every basis state
    else {
      keys = [...Array(N).keys()].filter((i) => prob(i) > 1e-9).sort((a, b) => prob(b) - prob(a)).slice(0, MAX_ROWS).sort((a, b) => a - b);
    }
    const sig = keys.join(',');
    if (sig !== this.rowKeys) {
      this.rowKeys = sig;
      this.rows = new Map(keys.map((k) => {
        const bar = el('span', { class: 'p-fill' });
        const val = el('span', { class: 'p-val' });
        const row = el('div', { class: 'p-row' }, el('span', { class: 'p-ket' }, `|${k.toString(2).padStart(n, '0')}⟩`), el('span', { class: 'p-bar' }, bar), val);
        return [k, { row, bar, val }];
      }));
      this.amps.replaceChildren(...[...this.rows.values()].map((r) => r.row));
    }
    for (const [k, r] of this.rows) {
      const p = prob(k), ang = (Math.atan2(f.im[k], f.re[k]) * 180) / Math.PI;
      r.bar.style.width = `${p * 100}%`;
      r.bar.style.background = p > 1e-9 ? `hsl(${(220 + ang + 360) % 360} 70% 55%)` : 'transparent';
      r.val.textContent = p > 1e-9 ? `${(p * 100).toFixed(1)}% ∠${ang.toFixed(0)}°` : '0%';
      r.row.classList.toggle('zero', p < 1e-9);
    }
    this.ampNote.textContent = N > 16 ? t('Showing the {k} largest of {N} amplitudes.', { k: keys.length, N }) : t('Bar = probability · colour and angle = phase.');
  }

  paintSpheres(f, ms) {
    const shown = Math.min(this.n, MAX_SPHERES);
    const target = Array.from({ length: shown }, (_, k) => blochAt(f.re, f.im, k));
    const from = this.vecs.length === shown ? this.vecs : target;
    if (!this.sphereEls || this.sphereEls.length !== shown) {
      this.sphereEls = Array.from({ length: shown }, (_, k) => el('figure', { class: 'p-sphere' },
        el('div', { class: 'p-svg' }), el('figcaption', {}, this.wireLabels?.[k] ?? `q${k}`)));
      this.spheres.replaceChildren(...this.sphereEls);
    }
    this.sphereNote.textContent = (this.n > shown ? t('+ {n} more qubits not shown.', { n: this.n - shown }) + ' ' : '')
      + t('A shorter arrow means the qubit is entangled with the others.');
    cancelAnimationFrame(this.raf);
    const draw = (vs) => vs.forEach((v, k) => { this.sphereEls[k].firstChild.innerHTML = bloch(v, { label: '', size: 84 }); });
    if (!ms) { draw(target); this.vecs = target; return; }
    const t0 = performance.now();
    const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
    const frame = (now) => {
      const a = ease(Math.min(1, (now - t0) / ms));
      const cur = target.map((v, k) => ({ x: from[k].x + (v.x - from[k].x) * a, y: from[k].y + (v.y - from[k].y) * a, z: from[k].z + (v.z - from[k].z) * a }));
      draw(cur);
      this.vecs = cur;
      if (a < 1) this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }
}

// Highlight helper for an SVG drawn by drawCircuit: current column, done columns, and the ones still to come.
export function circuitHighlighter(container) {
  return (key) => {
    const svg = container.querySelector('svg');
    if (!svg) return;
    svg.querySelectorAll('.c-col').forEach((g) => {
      const k = Number(g.dataset.col);
      g.classList.toggle('now', k === key);
      g.classList.toggle('todo', key == null || k > key);
    });
    svg.querySelectorAll('.c-band').forEach((b) => b.classList.toggle('on', Number(b.dataset.col) === key));
    const band = key == null ? null : svg.querySelector(`.c-band[data-col="${key}"]`);
    if (band) {
      const r = band.getBoundingClientRect(), c = container.getBoundingClientRect();
      if (r.left < c.left || r.right > c.right) container.scrollLeft += r.left - c.left - c.width / 2 + r.width / 2;
    } else if (key == null) container.scrollLeft = 0;
  };
}
