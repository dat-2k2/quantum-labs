import { LABS } from './labs.js';
import { drawCircuit } from './viz.js';
import { run } from './sim.js';
import { el } from './ui.js';

const $ = (id) => document.getElementById(id);

// ---------- lab grid + filters ----------
const CATS = ['All', ...new Set(LABS.map((l) => l.cat))];
let filter = 'All';
let current = null; // { lab, st, set }

function renderGrid() {
  $('filters').replaceChildren(...CATS.map((c) => el('button', {
    type: 'button', class: 'chip', 'aria-pressed': c === filter ? 'true' : 'false', onclick: () => { filter = c; renderGrid(); },
  }, c)));
  $('grid').replaceChildren(...LABS.filter((l) => filter === 'All' || l.cat === filter).map((lab) => el('button', {
    type: 'button', class: 'card', 'aria-current': current?.lab === lab ? 'true' : 'false',
    onclick: () => { openLab(lab.id); $('lab').scrollIntoView(); },
  },
  el('div', { class: 'card-top' }, el('span', { class: 'card-num' }, lab.num), el('span', { class: 'tag' }, lab.cat)),
  el('h3', {}, lab.title), el('p', {}, lab.desc), el('span', { class: 'card-link' }, 'Open lab →'))));
}

// ---------- lab workbench ----------
function openLab(id, updateHash = true) {
  const lab = LABS.find((l) => l.id === id) || LABS[2];
  const st = lab.init();
  const set = (patch = {}) => { Object.assign(st, patch); render(); };
  current = { lab, st, set };
  $('lab-eyebrow').textContent = `Lab ${lab.num} · ${lab.cat}`;
  $('lab-title').textContent = lab.title;
  $('lab-desc').textContent = lab.desc;
  $('lab-src').href = lab.url;
  $('steps').replaceChildren(...lab.steps.map(([t, d], i) => el('li', {},
    el('div', { class: 'step-n' }, `STEP ${i + 1}`), el('h4', {}, t), el('p', {}, d))));
  if (updateHash && location.hash !== `#lab/${lab.id}`) history.replaceState(null, '', `#lab/${lab.id}`);
  render();
  renderGrid();
}

function render() {
  const { lab, st, set } = current;
  const active = document.activeElement;
  const inControls = active && $('controls').contains(active);
  // While a slider is being dragged, keep the controls DOM alive; it is rebuilt on 'change'.
  if (!(inControls && active.type === 'range')) {
    const focusPath = inControls ? pathOf(active, $('controls')) : null;
    $('controls').replaceChildren(...lab.controls(st, set));
    if (focusPath) nodeAt(focusPath, $('controls'))?.focus();
  }

  const res = lab.compute(st, set);
  $('circuit').innerHTML = drawCircuit(res.ops, res.n, { expand: res.expand, wireLabels: res.wireLabels });
  const gates = countGates(res.ops, res.expand);
  $('circuit-tag').textContent = `${res.n} qubit${res.n === 1 ? '' : 's'} · ${gates} ops`;
  $('results').replaceChildren(...res.results);
  const extra = $('extra');
  extra.hidden = !res.extra;
  if (res.extra) extra.replaceChildren(...res.extra);
}

const countGates = (ops, expand) => ops.reduce((n, op) =>
  n + (op.g === 'BARRIER' ? 0 : op.g === 'BLOCK' && expand ? countGates(op.ops, expand) : 1), 0);
const pathOf = (node, root) => { const p = []; while (node && node !== root) { p.unshift([...node.parentNode.children].indexOf(node)); node = node.parentNode; } return p; };
const nodeAt = (path, root) => path.reduce((n, i) => n?.children[i], root);

$('controls').addEventListener('change', (e) => {
  if (e.target.type !== 'range') return;
  const path = pathOf(e.target, $('controls'));
  $('controls').replaceChildren(...current.lab.controls(current.st, current.set));
  nodeAt(path, $('controls'))?.focus();
});
$('run').addEventListener('click', () => current?.set());
$('prev').addEventListener('click', () => step(-1));
$('next').addEventListener('click', () => step(1));
function step(d) {
  const i = LABS.indexOf(current.lab);
  openLab(LABS[(i + d + LABS.length) % LABS.length].id);
}
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); current?.set(); }
});
window.addEventListener('hashchange', () => {
  const m = location.hash.match(/^#lab\/(\w+)/);
  if (m && m[1] !== current?.lab.id) openLab(m[1]);
});

// ---------- sandbox composer ----------
const TOOLS = ['H', 'X', 'Y', 'Z', 'S', 'T', '●', '⌫'];
const COLS = 12;
const comp = loadComposer() || { n: 3, tool: 'H', grid: emptyGrid(3) };
function emptyGrid(n) { return Array.from({ length: n }, () => Array(COLS).fill(null)); }
function loadComposer() {
  try { const c = JSON.parse(localStorage.getItem('ql-composer')); return c && c.grid?.length === c.n ? c : null; } catch { return null; }
}
function saveComposer() { try { localStorage.setItem('ql-composer', JSON.stringify(comp)); } catch { /* storage unavailable */ } }

function composerOps() {
  const ops = [];
  for (let c = 0; c < COLS; c++) {
    const ctrls = [];
    for (let q = 0; q < comp.n; q++) if (comp.grid[q][c] === '●') ctrls.push(q);
    for (let q = 0; q < comp.n; q++) {
      const g = comp.grid[q][c];
      if (g && g !== '●') ops.push({ g, t: [q], c: ctrls });
    }
  }
  return ops;
}

function renderComposer() {
  $('palette').replaceChildren(...TOOLS.map((t) => el('button', {
    type: 'button', class: 'tool' + (t === '⌫' ? ' erase' : ''), 'aria-pressed': comp.tool === t ? 'true' : 'false',
    title: t === '⌫' ? 'Eraser' : t === '●' ? 'Control dot' : `${t} gate`, onclick: () => { comp.tool = t; renderComposer(); },
  }, t)));

  const S = 48, LW = 64;
  const box = $('composer');
  box.style.gridTemplateColumns = `${LW}px repeat(${COLS}, ${S}px)`;
  box.style.gridAutoRows = `${S}px`;
  const kids = [];
  for (let q = 0; q < comp.n; q++) {
    kids.push(el('div', { class: 'wire', style: `top:${q * S + S / 2}px;left:${LW - 8}px;width:${COLS * S + 8}px` }));
  }
  for (let c = 0; c < COLS; c++) {
    const used = range(comp.n).filter((q) => comp.grid[q][c]);
    const hasCtrl = used.some((q) => comp.grid[q][c] === '●');
    if (hasCtrl && used.length > 1) {
      const lo = Math.min(...used), hi = Math.max(...used);
      kids.push(el('div', { class: 'vconn', style: `left:${LW + c * S + S / 2 - 1}px;top:${lo * S + S / 2}px;height:${(hi - lo) * S}px` }));
    }
  }
  for (let q = 0; q < comp.n; q++) {
    kids.push(el('div', { class: 'qlabel' }, `q${q}  |0⟩`));
    for (let c = 0; c < COLS; c++) {
      const g = comp.grid[q][c];
      const ctrlInCol = range(comp.n).some((r) => comp.grid[r][c] === '●');
      const cls = !g ? '' : g === '●' ? ' dot' : g === 'X' && ctrlInCol ? ' oplus' : ' g';
      kids.push(el('button', {
        type: 'button', class: 'slot' + cls, 'aria-label': `q${q} column ${c + 1}${g ? ': ' + g : ''}`,
        onclick: () => {
          comp.grid[q][c] = comp.tool === '⌫' || comp.grid[q][c] === comp.tool ? null : comp.tool;
          update();
        },
        oncontextmenu: (e) => { e.preventDefault(); comp.grid[q][c] = null; update(); },
      }, g && g !== '●' ? (cls === ' oplus' ? '⊕' : g) : ''));
    }
  }
  box.replaceChildren(...kids);

  const preset = (name, cells) => el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => {
    comp.grid = emptyGrid(comp.n); cells.forEach(([q, c, g]) => { if (q < comp.n) comp.grid[q][c] = g; }); update();
  } }, name);
  $('composer-actions').replaceChildren(
    el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => resize(1), disabled: comp.n >= 6 }, '+ qubit'),
    el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => resize(-1), disabled: comp.n <= 1 }, '− qubit'),
    preset('Bell pair', [[0, 0, 'H'], [0, 1, '●'], [1, 1, 'X']]),
    preset('GHZ', [[0, 0, 'H'], [0, 1, '●'], [1, 1, 'X'], [1, 2, '●'], [2, 2, 'X']]),
    preset('Phase kickback', [[0, 0, 'H'], [1, 0, 'X'], [0, 1, '●'], [1, 1, 'Z'], [0, 2, 'H']]),
    preset('Clear', []),
  );
  renderState();
}

function resize(d) {
  const n = comp.n + d;
  comp.grid = d > 0 ? [...comp.grid, Array(COLS).fill(null)] : comp.grid.slice(0, n);
  comp.n = n;
  update();
}
function update() { saveComposer(); renderComposer(); }
const range = (n) => Array.from({ length: n }, (_, i) => i);

function renderState() {
  const s = run(comp.n, composerOps());
  const rows = [];
  for (let i = 0; i < s.N; i++) {
    const p = s.prob(i);
    if (p < 1e-9) continue;
    const ang = (Math.atan2(s.im[i], s.re[i]) * 180) / Math.PI;
    const hue = (ang + 360) % 360;
    rows.push(el('div', { class: 'sv-row' },
      el('span', { class: 'sv-k' }, `|${i.toString(2).padStart(comp.n, '0')}⟩`),
      el('span', { class: 'sv-bar' }, el('span', { style: `width:${p * 100}%;background:hsl(${(170 + hue) % 360} 75% 65%)` })),
      el('span', { class: 'sv-v' }, `${(p * 100).toFixed(1)}% ∠${ang.toFixed(0)}°`)));
  }
  $('statevec').replaceChildren(el('div', { class: 'sv' }, ...rows.slice(0, 32)),
    el('div', { class: 'sv-note' }, 'Bar = probability · colour and angle = phase. Basis states read q' + (comp.n - 1) + ' … q0. Right-click a cell to erase.'));
}

// ---------- boot ----------
const deepLink = location.hash.match(/^#lab\/(\w+)/)?.[1];
openLab(deepLink ?? 'bv', false);
renderComposer();
if (deepLink) $('lab').scrollIntoView();
