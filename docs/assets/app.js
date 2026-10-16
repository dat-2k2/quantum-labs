import { LABS } from './labs.js';
import { drawCircuit } from './viz.js';
import { run } from './sim.js';
import { el } from './ui.js';
import { CHAPTERS, MISSIONS, CHALLENGES } from './missions.js';
import * as G from './game.js';

const $ = (id) => document.getElementById(id);
const labById = (id) => LABS.find((l) => l.id === id);
const short = (lab) => lab.title.replace('’s Algorithm', '').replace(': factor 15', '');

// ============================================================ HUD + quest map
let lockPrompt = null;

function renderHud() {
  const lv = G.level(), st = G.state();
  $('hud').replaceChildren(
    el('span', { class: 'hud-xp' }, `⚡ ${st.xp} XP`),
    el('span', { class: 'hud-lv' }, el('span', {}, `Lv ${lv.i} · ${lv.name}`), el('span', { class: 'meter' }, el('span', { style: `width:${lv.pct * 100}%` }))),
    el('span', { class: 'hud-badges' }, `🏅 ${st.badges.length}`));
}

function starStr(n) { return '★'.repeat(n) + '☆'.repeat(3 - n); }

function renderQuest() {
  $('chapters').replaceChildren(...CHAPTERS.map((ch, ci) => {
    const done = ch.labs.filter(G.labComplete).length;
    const track = el('div', { class: 'track' });
    ch.labs.forEach((id, i) => {
      const lab = labById(id), unlocked = G.isUnlocked(id), complete = G.labComplete(id);
      const isCurrent = current?.lab.id === id;
      const state = complete ? 'done' : !unlocked ? 'locked' : isCurrent || G.nextUp() === id ? 'current' : 'open';
      if (i) track.append(el('span', { class: 'link' + (unlocked ? ' on' : '') }));
      const node = el('div', { class: 'node-wrap' },
        el('button', {
          type: 'button', class: `node node-${state}`, 'aria-label': `${lab.title}${unlocked ? '' : ' (locked)'}`,
          onclick: () => {
            if (!unlocked) { lockPrompt = lockPrompt === id ? null : id; renderQuest(); return; }
            openLab(id); $('lab').scrollIntoView();
          },
        }, el('span', { class: 'disc' }, complete ? '✓' : unlocked ? lab.num : '🔒'),
        el('span', { class: 'node-label' }, short(lab)),
        el('span', { class: 'node-stars' }, starStr(G.stars(id)))),
        lockPrompt === id ? el('div', { class: 'lock-pop' },
          el('span', {}, `Clear a mission in ${short(labById(G.ORDER[G.ORDER.indexOf(id) - 1]))} first.`),
          el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => { G.unlock(id); lockPrompt = null; openLab(id); $('lab').scrollIntoView(); } }, 'Skip ahead')) : null);
      track.append(node);
    });
    return el('div', { class: 'chapter' + (done === ch.labs.length ? ' cleared' : '') },
      el('div', { class: 'chapter-info' },
        el('div', { class: 'field-label' }, `Chapter ${ci + 1}`),
        el('h3', {}, ch.name),
        el('div', { class: 'chapter-count' }, `${done}/${ch.labs.length} complete`)),
      track);
  }));

  const lv = G.level(), st = G.state(), next = labById(G.nextUp());
  const left = G.labTotal(next.id) - G.doneList(next.id).length;
  $('side').replaceChildren(
    el('div', { class: 'panel player' },
      el('div', { class: 'field-label' }, `Level ${lv.i}`),
      el('div', { class: 'player-name' }, lv.name),
      el('div', { class: 'meter big' }, el('span', { style: `width:${lv.pct * 100}%` })),
      el('div', { class: 'player-xp' }, lv.next ? `${st.xp} / ${lv.next} XP to ${lv.nextName}` : `${st.xp} XP — max level!`)),
    el('div', { class: 'panel nextup' },
      el('div', { class: 'field-label' }, G.labComplete(next.id) ? 'All done!' : 'Next up'),
      el('div', { class: 'player-name sm' }, next.title),
      el('div', { class: 'player-xp' }, left ? `${left} of ${G.labTotal(next.id)} missions left` : 'Every mission cleared'),
      el('button', { type: 'button', class: 'btn btn-primary', onclick: () => { openLab(next.id); $('lab').scrollIntoView(); } },
        G.doneList(next.id).length ? 'Resume lab →' : 'Start lab →')),
    el('div', { class: 'panel badges' },
      el('div', { class: 'field-label' }, `Badges  ${st.badges.length} / ${G.ALL_BADGES.length}`),
      el('div', { class: 'badge-grid' }, ...G.ALL_BADGES.map((id) => {
        const [emoji, name] = G.badgeInfo(id), got = st.badges.includes(id);
        return el('div', { class: 'badge' + (got ? ' got' : ''), title: got ? name : `${name} (locked)` },
          el('span', { class: 'hex' }, got ? emoji : '?'), el('span', { class: 'badge-name' }, name));
      }))),
    el('button', { type: 'button', class: 'reset', onclick: () => {
      if (confirm('Reset all XP, missions and badges?')) { G.reset(); openLab(G.ORDER[0], false); }
    } }, 'Reset progress'));

  $('cta-resume').textContent = st.xp ? `Resume: ${short(next)} →` : 'Start the quest';
  $('cta-resume').onclick = (e) => { e.preventDefault(); openLab(next.id); $('lab').scrollIntoView(); };
}

// ============================================================ lab tutorial
let current = null; // { lab, st, set, tab, interacted, facts }
const wrong = new Set(); // wrong quiz answers picked this visit: `${lab}/${mission}/${option}`

function openLab(id, updateHash = true) {
  const lab = labById(id) || LABS[0];
  const st = lab.init();
  const set = (patch = {}) => { Object.assign(st, patch); current.interacted = true; render(); };
  current = { lab, st, set, interacted: false, tab: G.doneList(lab.id).length ? 'missions' : 'learn' };
  const ci = G.chapterOf(lab.id);
  $('lab-eyebrow').textContent = `Chapter ${ci + 1} · ${CHAPTERS[ci].name} · Lab ${lab.num} / ${LABS.length}`;
  $('lab-title').textContent = lab.title;
  $('lab-desc').textContent = lab.desc;
  $('lab-src').href = lab.url;
  if (updateHash && location.hash !== `#lab/${lab.id}`) history.replaceState(null, '', `#lab/${lab.id}`);
  render();
  renderQuest();
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
  $('circuit-tag').textContent = `${res.n} qubit${res.n === 1 ? '' : 's'} · ${countGates(res.ops, res.expand)} ops`;
  $('results').replaceChildren(...res.results);
  $('extra').hidden = !res.extra;
  if (res.extra) $('extra').replaceChildren(...res.extra);

  current.facts = res.facts;
  if (current.interacted) {
    for (const m of MISSIONS[lab.id]) {
      if (m.check && !G.isDone(lab.id, m.id) && m.check(res.facts, st)) G.complete(lab.id, m);
    }
  }
  renderMission();
}

function renderMission() {
  const { lab, tab } = current;
  const ms = MISSIONS[lab.id];
  const actions = ms.filter((m) => m.check), quizzes = ms.filter((m) => m.quiz);
  const nDone = (list) => list.filter((m) => G.isDone(lab.id, m.id)).length;
  const setTab = (t) => { current.tab = t; renderMission(); };

  const tabs = el('div', { class: 'seg tabs', role: 'tablist' }, ...[
    ['learn', '1 · Learn'], ['missions', `2 · Missions ${nDone(actions)}/${actions.length}`], ['quiz', `3 · Quiz ${nDone(quizzes)}/${quizzes.length}`],
  ].map(([t, label]) => el('button', { type: 'button', role: 'tab', 'aria-selected': t === tab ? 'true' : 'false', class: t === tab ? 'on' : '', onclick: () => setTab(t) }, label)));

  const total = ms.length, done = G.doneList(lab.id).length;
  const progress = el('div', { class: 'mprog' },
    el('div', { class: 'field-head' }, el('span', { class: 'field-label' }, 'Progress'), el('span', { class: 'field-value' }, `${done} / ${total}`)),
    el('div', { class: 'meter' }, el('span', { style: `width:${(100 * done) / total}%` })));

  let body;
  if (tab === 'learn') {
    body = el('div', { class: 'lesson' },
      el('ol', { class: 'lesson-steps' }, ...lab.steps.map(([t, d], i) => el('li', {},
        el('span', { class: 'lesson-n' }, String(i + 1)), el('div', {}, el('h4', {}, t), el('p', {}, d))))),
      el('p', { class: 'note' }, 'Play with the controls on the right while you read — every change re-runs the circuit.'),
      el('button', { type: 'button', class: 'btn btn-primary', onclick: () => setTab('missions') }, 'Start the missions →'));
  } else if (tab === 'missions') {
    const activeId = actions.find((m) => !G.isDone(lab.id, m.id))?.id;
    body = el('ol', { class: 'tasks' }, ...actions.map((m, i) => {
      const d = G.isDone(lab.id, m.id), isActive = m.id === activeId;
      const hint = !d ? el('details', { class: 'hint', open: G.hintUsed(lab.id, m.id) }, el('summary', {}, el('span', {}, '💡 Stuck? Get a hint'), el('span', {}, '−5 XP')), el('p', {}, m.hint)) : null;
      if (hint) hint.addEventListener('toggle', () => { if (hint.open && !G.hintUsed(lab.id, m.id)) { G.useHint(lab.id, m.id); renderMission(); } });
      return el('li', { class: `task${d ? ' done' : ''}${isActive ? ' active' : ''}` },
        el('span', { class: 'check', 'aria-hidden': 'true' }, d ? '✓' : String(i + 1)),
        el('div', { class: 'task-body' }, el('span', { class: 'task-text' }, m.text), isActive || G.hintUsed(lab.id, m.id) ? hint : null),
        el('span', { class: 'task-xp' }, `+${m.xp - (G.hintUsed(lab.id, m.id) ? 5 : 0)} XP`));
    }));
  } else {
    body = el('div', { class: 'quizzes' }, ...quizzes.map((m) => {
      const d = G.isDone(lab.id, m.id);
      return el('div', { class: 'quiz' + (d ? ' done' : '') },
        el('p', { class: 'quiz-q' }, m.quiz.q),
        el('div', { class: 'quiz-opts' }, ...m.quiz.options.map((o, oi) => {
          const key = `${lab.id}/${m.id}/${oi}`;
          const cls = d && oi === m.quiz.answer ? ' right' : wrong.has(key) ? ' wrong' : '';
          return el('button', { type: 'button', class: 'opt' + cls, disabled: d, onclick: () => {
            const tries = G.quizTry(lab.id, m.id);
            if (oi === m.quiz.answer) G.complete(lab.id, m, { firstTry: tries === 1 });
            else wrong.add(key);
            renderMission();
          } }, o);
        })),
        d ? el('p', { class: 'quiz-explain' }, '✓ ', m.quiz.explain) : el('span', { class: 'task-xp' }, `+${m.xp} XP`));
    }));
  }

  const i = G.ORDER.indexOf(lab.id);
  const prevId = G.ORDER[i - 1], nextId = G.ORDER[i + 1];
  const banner = G.labComplete(lab.id)
    ? el('div', { class: 'complete' }, el('div', { class: 'complete-big' }, `${G.badgeInfo(lab.id)[0]} Lab complete!`),
      el('div', { class: 'note' }, `Badge earned: ${G.badgeInfo(lab.id)[1]}`)) : null;
  const foot = el('div', { class: 'mfoot' },
    el('button', { type: 'button', class: 'btn btn-ghost btn-sm', disabled: !prevId, onclick: () => openLab(prevId) }, '← Back'),
    el('span', { class: 'mfoot-count' }, `${i + 1} / ${G.ORDER.length}`),
    el('button', { type: 'button', class: `btn btn-sm ${G.labComplete(lab.id) ? 'btn-primary' : 'btn-ghost'}`, disabled: !nextId, onclick: () => {
      if (G.isUnlocked(nextId)) openLab(nextId);
      else G.toast('🔒', 'Clear one mission here to unlock the next lab — or skip ahead from the quest map.', 'lock');
    } }, 'Next lab →'));

  $('mission').replaceChildren(tabs, progress, banner || '', body, foot);
  $('lab-stars').textContent = starStr(G.stars(lab.id));
  $('lab-xp').textContent = `+${G.labXp(lab.id)} / ${G.labXpMax(lab.id)} XP`;
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
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); current?.set(); }
});
window.addEventListener('hashchange', () => {
  const m = location.hash.match(/^#lab\/(\w+)/);
  if (m && m[1] !== current?.lab.id) openLab(m[1]);
});

// ============================================================ arena (sandbox + puzzles)
const TOOLS = ['H', 'X', 'Y', 'Z', 'S', 'T', '●', '⌫'];
const COLS = 12;
const comp = loadComposer() || { n: 3, tool: 'H', grid: emptyGrid(3), challenge: null };
function emptyGrid(n) { return Array.from({ length: n }, () => Array(COLS).fill(null)); }
function loadComposer() {
  try { const c = JSON.parse(localStorage.getItem('ql-composer')); return c && c.grid?.length === c.n ? c : null; } catch { return null; }
}
function saveComposer() { try { localStorage.setItem('ql-composer', JSON.stringify(comp)); } catch { /* storage unavailable */ } }
const range = (n) => Array.from({ length: n }, (_, i) => i);
const challenge = () => CHALLENGES.find((c) => c.id === comp.challenge);
const allowedTool = (t) => { const c = challenge(); return !c?.allowed || t === '⌫' || c.allowed.includes(t); };

function composerOps() {
  const ops = [];
  for (let c = 0; c < COLS; c++) {
    const ctrls = range(comp.n).filter((q) => comp.grid[q][c] === '●');
    for (let q = 0; q < comp.n; q++) {
      const g = comp.grid[q][c];
      if (g && g !== '●') ops.push({ g, t: [q], c: ctrls });
    }
  }
  return ops;
}

function pickChallenge(id) {
  comp.challenge = id;
  const c = challenge();
  if (c) { comp.n = c.n; comp.grid = emptyGrid(c.n); if (!allowedTool(comp.tool)) comp.tool = c.allowed[0]; }
  update();
}

function renderChallenges() {
  const solved = G.state().arena;
  $('challenges').replaceChildren(
    el('button', { type: 'button', role: 'listitem', class: 'chal' + (!comp.challenge ? ' on' : ''), onclick: () => pickChallenge(null) },
      el('span', { class: 'chal-icon' }, '∞'), el('span', { class: 'chal-title' }, 'Free play'), el('span', { class: 'chal-goal' }, 'No target — just explore')),
    ...CHALLENGES.map((c) => el('button', {
      type: 'button', role: 'listitem', class: 'chal' + (comp.challenge === c.id ? ' on' : '') + (solved.includes(c.id) ? ' solved' : ''), onclick: () => pickChallenge(c.id),
    }, el('span', { class: 'chal-icon' }, solved.includes(c.id) ? '✓' : `${c.n}q`), el('span', { class: 'chal-title' }, c.title),
    el('span', { class: 'chal-goal' }, c.goal), el('span', { class: 'task-xp' }, `+${c.xp} XP`))));
}

function renderComposer() {
  renderChallenges();
  $('palette').replaceChildren(...TOOLS.map((t) => el('button', {
    type: 'button', class: 'tool' + (t === '⌫' ? ' erase' : ''), 'aria-pressed': comp.tool === t ? 'true' : 'false', disabled: !allowedTool(t),
    title: t === '⌫' ? 'Eraser' : t === '●' ? 'Control dot' : `${t} gate`, onclick: () => { comp.tool = t; renderComposer(); },
  }, t)));

  const S = 48, LW = 64;
  const box = $('composer');
  box.style.gridTemplateColumns = `${LW}px repeat(${COLS}, ${S}px)`;
  box.style.gridAutoRows = `${S}px`;
  const kids = [];
  for (let q = 0; q < comp.n; q++) kids.push(el('div', { class: 'wire', style: `top:${q * S + S / 2}px;left:${LW - 8}px;width:${COLS * S + 8}px` }));
  for (let c = 0; c < COLS; c++) {
    const used = range(comp.n).filter((q) => comp.grid[q][c]);
    if (used.some((q) => comp.grid[q][c] === '●') && used.length > 1) {
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
        onclick: () => { comp.grid[q][c] = comp.tool === '⌫' || comp.grid[q][c] === comp.tool ? null : comp.tool; update(); },
        oncontextmenu: (e) => { e.preventDefault(); comp.grid[q][c] = null; update(); },
      }, g && g !== '●' ? (cls === ' oplus' ? '⊕' : g) : ''));
    }
  }
  box.replaceChildren(...kids);

  const preset = (name, cells) => el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => {
    comp.challenge = null; comp.grid = emptyGrid(comp.n); cells.forEach(([q, c, g]) => { if (q < comp.n) comp.grid[q][c] = g; }); update();
  } }, name);
  const c = challenge();
  $('composer-actions').replaceChildren(
    el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => resize(1), disabled: !!c || comp.n >= 6 }, '+ qubit'),
    el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => resize(-1), disabled: !!c || comp.n <= 1 }, '− qubit'),
    ...(c ? [] : [preset('Bell pair', [[0, 0, 'H'], [0, 1, '●'], [1, 1, 'X']]), preset('GHZ', [[0, 0, 'H'], [0, 1, '●'], [1, 1, 'X'], [1, 2, '●'], [2, 2, 'X']])]),
    el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => { comp.grid = emptyGrid(comp.n); update(); } }, 'Clear'));
  renderState();
}

function resize(d) {
  const n = comp.n + d;
  comp.grid = d > 0 ? [...comp.grid, Array(COLS).fill(null)] : comp.grid.slice(0, n);
  comp.n = n;
  update();
}
function update() { saveComposer(); renderComposer(); }

function renderState() {
  const s = run(comp.n, composerOps());
  const rows = [];
  for (let i = 0; i < s.N; i++) {
    const p = s.prob(i);
    if (p < 1e-9) continue;
    const ang = (Math.atan2(s.im[i], s.re[i]) * 180) / Math.PI;
    rows.push(el('div', { class: 'sv-row' },
      el('span', { class: 'sv-k' }, `|${i.toString(2).padStart(comp.n, '0')}⟩`),
      el('span', { class: 'sv-bar' }, el('span', { style: `width:${p * 100}%;background:hsl(${(170 + ang + 360) % 360} 75% 65%)` })),
      el('span', { class: 'sv-v' }, `${(p * 100).toFixed(1)}% ∠${ang.toFixed(0)}°`)));
  }
  $('statevec').replaceChildren(el('div', { class: 'sv' }, ...rows.slice(0, 32)),
    el('div', { class: 'sv-note' }, `Bar = probability · colour and angle = phase. Basis states read q${comp.n - 1} … q0. Right-click a cell to erase.`));

  const c = challenge();
  if (!c) { $('goal').replaceChildren(); $('goal').hidden = true; return; }
  // overlap with the target, ignoring global phase
  let re = 0, im = 0;
  for (const [k, tr, ti] of c.target) { re += tr * s.re[k] + ti * s.im[k]; im += tr * s.im[k] - ti * s.re[k]; }
  const match = re * re + im * im;
  const used = new Set(comp.grid.flat().filter(Boolean));
  const legal = !c.allowed || [...used].every((g) => c.allowed.includes(g));
  const solved = match > 0.999 && legal;
  if (solved) G.completeChallenge(c);
  $('goal').hidden = false;
  $('goal').replaceChildren(
    el('div', { class: 'goal-head' }, el('span', { class: 'field-label' }, `Challenge · ${c.title}`), el('span', { class: 'task-xp' }, `+${c.xp} XP`)),
    el('div', { class: 'goal-text' }, c.goal),
    el('div', { class: 'meter' + (solved ? ' ok' : '') }, el('span', { style: `width:${match * 100}%` })),
    el('div', { class: 'note' }, solved ? '✓ Solved! Pick another puzzle above.' : !legal ? `Only ${c.allowed.join(' and ')} gates are allowed here.` : `Match with target: ${(match * 100).toFixed(0)}%`));
  if (solved) renderChallenges();
}

// ============================================================ boot
G.onChange(() => { renderHud(); renderQuest(); });
renderHud();
const deepLink = location.hash.match(/^#lab\/(\w+)/)?.[1];
openLab(deepLink ?? G.nextUp(), false);
renderComposer();
if (deepLink) $('lab').scrollIntoView();
