import { LABS } from './labs.js';
import { drawCircuit } from './viz.js';
import { run } from './sim.js';
import { el } from './ui.js';
import { CHAPTERS, MISSIONS, CHALLENGES } from './missions.js';
import * as G from './game.js';

const $ = (id) => document.getElementById(id);
const labById = (id) => LABS.find((l) => l.id === id);
const short = (lab) => lab.title.replace('’s Algorithm', '').replace(': factor 15', '');
const starStr = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

// ============================================================ routing
// #/            course
// #/lab/<id>    lesson (focus mode)
// #/arena       circuit puzzles
function route() {
  const h = location.hash;
  const lab = h.match(/^#\/?lab\/(\w+)/)?.[1];
  const view = lab && labById(lab) ? 'lesson' : h.startsWith('#/arena') ? 'arena' : 'course';
  for (const v of ['course', 'lesson', 'arena']) $(`view-${v}`).hidden = v !== view;
  document.body.classList.toggle('focus', view === 'lesson');
  document.querySelectorAll('[data-route]').forEach((a) => a.classList.toggle('on', a.dataset.route === view));
  if (view === 'lesson') { if (current?.lab.id !== lab) openLab(lab); }
  else { current = null; }
  if (view === 'course') renderCourse();
  if (view === 'arena') renderComposer();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
const go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };

// ============================================================ HUD + course
function renderHud() {
  const lv = G.level();
  $('hud').textContent = `${G.state().xp} XP · Level ${lv.i}`;
  $('hud').title = lv.name;
}

let lockOpen = null;
function renderCourse() {
  const st = G.state(), next = labById(G.nextUp());
  const started = st.xp > 0;
  $('cta').textContent = started ? `Continue: ${short(next)}  →` : 'Start the first lab  →';
  $('cta').href = `#/lab/${next.id}`;

  $('chapters').replaceChildren(...CHAPTERS.map((ch, ci) => {
    const done = ch.labs.filter(G.labComplete).length;
    return el('section', { class: 'chapter' },
      el('div', { class: 'chapter-head' },
        el('span', { class: 'num' }, String(ci + 1).padStart(2, '0')), el('h2', {}, ch.name),
        el('span', { class: 'count' }, `${done}/${ch.labs.length}`)),
      ...ch.labs.map((id) => {
        const lab = labById(id), unlocked = G.isUnlocked(id), complete = G.labComplete(id);
        const n = G.doneList(id).length, total = G.labTotal(id);
        const isNext = id === next.id && !complete;
        const label = complete ? 'Review' : !unlocked ? 'Locked' : n ? 'Continue' : 'Start';
        const open = () => {
          if (unlocked) go(`#/lab/${id}`);
          else { lockOpen = lockOpen === id ? null : id; renderCourse(); }
        };
        const prev = labById(G.ORDER[G.ORDER.indexOf(id) - 1]);
        return el('div', { class: 'row' + (unlocked ? '' : ' locked'), onclick: open },
          el('span', { class: 'ring' + (complete ? ' done' : ''), style: `--p:${(100 * n) / total}` }, complete ? '✓' : ''),
          el('div', {}, el('div', { class: 'row-title' }, lab.title), el('div', { class: 'row-desc' }, lab.desc)),
          el('span', { class: 'row-count' }, `${n}/${total}`),
          el('button', { type: 'button', class: `btn btn-sm ${isNext ? 'btn-primary' : 'btn-ghost'}`, onclick: (e) => { e.stopPropagation(); open(); } }, label),
          lockOpen === id ? el('div', { class: 'row-lock', onclick: (e) => e.stopPropagation() },
            el('span', {}, `Clear one mission in ${short(prev)} to unlock.`),
            el('button', { type: 'button', class: 'link-btn', onclick: () => { G.unlock(id); lockOpen = null; go(`#/lab/${id}`); } }, 'Skip ahead →')) : null);
      }));
  }), el('section', { class: 'chapter' },
    el('div', { class: 'chapter-head' }, el('span', { class: 'num' }, '++'), el('h2', {}, 'Practice'),
      el('span', { class: 'count' }, `${st.arena.length}/${CHALLENGES.length}`)),
    el('div', { class: 'row', onclick: () => go('#/arena') },
      el('span', { class: 'ring' + (st.arena.length === CHALLENGES.length ? ' done' : ''), style: `--p:${(100 * st.arena.length) / CHALLENGES.length}` }),
      el('div', {}, el('div', { class: 'row-title' }, 'Arena: circuit puzzles'), el('div', { class: 'row-desc' }, 'Build Bell pairs, GHZ states and more from scratch')),
      el('span', { class: 'row-count' }, `${st.arena.length}/${CHALLENGES.length}`),
      el('button', { type: 'button', class: 'btn btn-sm btn-ghost' }, 'Open'))));

  const lv = G.level();
  const labsDone = G.ORDER.filter(G.labComplete).length;
  const missions = G.ORDER.reduce((a, id) => a + G.doneList(id).length, 0);
  const totalMissions = G.ORDER.reduce((a, id) => a + G.labTotal(id), 0);
  $('strip').textContent = `${labsDone}/${G.ORDER.length} labs · ${missions}/${totalMissions} missions · badges ${st.badges.length}/${G.ALL_BADGES.length}`;
  $('side').replaceChildren(
    el('div', { class: 'label' }, 'Your progress'),
    el('div', { class: 'side-level' },
      el('div', { class: 'name' }, `Level ${lv.i} · ${lv.name}`),
      el('div', { class: 'meter' }, el('span', { style: `width:${lv.pct * 100}%` })),
      el('div', { class: 'mono-sm' }, lv.next ? `${st.xp} / ${lv.next} XP to ${lv.nextName}` : `${st.xp} XP — top level`)),
    el('dl', { class: 'stats' }, ...[
      ['Labs completed', `${labsDone} / ${G.ORDER.length}`], ['Missions', `${missions} / ${totalMissions}`],
      ['Badges', `${st.badges.length} / ${G.ALL_BADGES.length}`], ['Arena puzzles', `${st.arena.length} / ${CHALLENGES.length}`],
    ].map(([k, v]) => el('div', {}, el('dt', {}, k), el('dd', {}, v)))),
    el('div', { class: 'side-level' }, el('div', { class: 'field-label' }, `Badges · ${st.badges.length}/${G.ALL_BADGES.length}`),
      el('div', { class: 'medals' }, ...G.ALL_BADGES.map((id) => {
        const [emoji, name] = G.badgeInfo(id), got = st.badges.includes(id);
        return el('span', { class: 'medal' + (got ? ' got' : ''), title: got ? name : `${name} — locked`, 'aria-label': got ? name : `${name} (locked)` }, emoji);
      }))),
    el('button', { type: 'button', class: 'link-btn reset', onclick: () => { if (confirm('Reset all XP, missions and badges?')) { G.reset(); renderCourse(); } } }, 'Reset progress'));
}

// ============================================================ lesson
let current = null; // { lab, st, set, steps, step, interacted, sel, wrong }

function stepsFor(lab) {
  const ms = MISSIONS[lab.id];
  return [{ type: 'learn' }, ...ms.filter((m) => m.check).map((m) => ({ type: 'mission', m })),
    ...ms.filter((m) => m.quiz).map((m) => ({ type: 'quiz', m })), { type: 'done' }];
}
const stepDone = (s) => s.type === 'learn' ? current.step > 0 || G.doneList(current.lab.id).length > 0
  : (s.type === 'mission' || s.type === 'quiz') && G.isDone(current.lab.id, s.m.id);

function openLab(id) {
  const lab = labById(id);
  const st = lab.init();
  const set = (patch = {}) => { Object.assign(st, patch); current.interacted = true; renderWorkspace(); };
  const steps = stepsFor(lab);
  const firstOpen = steps.findIndex((s, i) => i > 0 && s.type !== 'done' && !G.isDone(id, s.m.id));
  current = { lab, st, set, steps, step: G.doneList(id).length ? (firstOpen < 0 ? steps.length - 1 : firstOpen) : 0, interacted: false, sel: null, wrong: false };
  renderWorkspace();
}

function showToc(on) {
  document.body.classList.toggle('show-toc', on);
  $('seg-toc').setAttribute('aria-pressed', String(on));
  $('seg-step').setAttribute('aria-pressed', String(!on));
}
$('seg-toc').addEventListener('click', () => showToc(true));
$('seg-step').addEventListener('click', () => showToc(false));

function goStep(i) {
  showToc(false);
  current.step = Math.max(0, Math.min(current.steps.length - 1, i));
  current.sel = null; current.wrong = false;
  renderStep();
  window.scrollTo(0, 0);
}

function renderWorkspace() {
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

  if (current.interacted) {
    const here = current.steps[current.step];
    for (const m of MISSIONS[lab.id]) {
      if (m.check && !G.isDone(lab.id, m.id) && m.check(res.facts, st)) G.complete(lab.id, m, { quiet: here.m === m });
    }
  }
  renderStep();
}

function renderStep() {
  const { lab, steps, step } = current;
  const s = steps[step];
  const ci = G.chapterOf(lab.id);
  const actions = steps.filter((x) => x.type === 'mission');
  const quizzes = steps.filter((x) => x.type === 'quiz');

  const stepLabel = (x) => x.type === 'learn' ? 'Lesson' : x.type === 'done' ? 'Summary'
    : x.type === 'quiz' ? `Quiz ${quizzes.indexOf(x) + 1}` : `Mission ${actions.indexOf(x) + 1}`;
  // top bar
  $('segs').replaceChildren(...steps.slice(0, -1).map((x, i) => el('span', {
    class: stepDone(x) ? 'on' : i === step ? 'here' : '',
  })));
  $('lxp').textContent = `⚡ ${G.state().xp} XP`;
  $('seg-step').textContent = stepLabel(s);

  // contents
  const nextId = G.ORDER[G.ORDER.indexOf(lab.id) + 1];
  $('toc').replaceChildren(
    el('p', { class: 'eyebrow' }, `${String(ci + 1).padStart(2, '0')} · ${CHAPTERS[ci].name}`),
    el('div', { class: 'toc-lab' }, lab.title),
    ...steps.map((x, i) => el('button', { type: 'button', class: i === step ? 'here' : '', onclick: () => goStep(i) },
      el('span', { class: 'mark' + (stepDone(x) ? ' ok' : '') }, stepDone(x) ? '✓' : i === step ? '●' : '○'),
      el('span', {}, stepLabel(x)))),
    el('div', { class: 'toc-next' }, 'Next: ', nextId ? el('a', { href: `#/lab/${nextId}` }, labById(nextId).title) : el('a', { href: '#/arena' }, 'Arena puzzles')));

  // stage
  $('ws').hidden = s.type === 'quiz' || s.type === 'done';
  const eyebrow = { learn: `Lesson · ${lab.title}`, mission: `Mission ${actions.indexOf(s) + 1} of ${actions.length} · ${lab.title}`,
    quiz: `Quiz · ${lab.title}`, done: `Summary · ${lab.title}` }[s.type];
  $('s-eyebrow').textContent = eyebrow;
  $('s-title').textContent = s.type === 'learn' ? lab.desc : s.type === 'mission' ? s.m.text : s.type === 'quiz' ? s.m.quiz.q
    : G.labComplete(lab.id) ? 'Lab complete.' : 'Almost there.';

  let body = [];
  if (s.type === 'learn') {
    body = [el('ol', { class: 'lesson-steps' }, ...lab.steps.map(([t, d], i) => el('li', {},
      el('span', { class: 'n' }, String(i + 1)), el('div', {}, el('h4', {}, t), el('p', {}, d)))))];
  } else if (s.type === 'quiz') {
    const done = G.isDone(lab.id, s.m.id);
    body = [el('div', { class: 'opts', role: 'radiogroup' }, ...s.m.quiz.options.map((o, oi) => {
      const cls = done ? (oi === s.m.quiz.answer ? ' right' : '') : current.sel === oi ? (current.wrong ? ' wrong sel' : ' sel') : '';
      return el('button', { type: 'button', role: 'radio', 'aria-checked': current.sel === oi || (done && oi === s.m.quiz.answer) ? 'true' : 'false',
        class: 'opt' + cls, disabled: done, onclick: () => { current.sel = oi; current.wrong = false; renderStep(); } },
      el('span', { class: 'radio' }), el('span', {}, o));
    }))];
  } else if (s.type === 'done') {
    const ms = MISSIONS[lab.id];
    body = [el('div', { class: 'summary' },
      el('div', { class: 'big', 'aria-label': `${G.stars(lab.id)} of 3 stars` }, starStr(G.stars(lab.id))),
      el('div', { class: 'muted' }, `${G.labXp(lab.id)} of ${G.labXpMax(lab.id)} XP earned${G.labComplete(lab.id) ? ` · badge: ${G.badgeInfo(lab.id).join(' ')}` : ''}`),
      el('ul', {}, ...ms.map((m) => {
        const d = G.isDone(lab.id, m.id);
        return el('li', { class: d ? 'ok' : '' }, el('span', { class: 'mark' }, d ? '✓' : '○'), el('span', {}, m.quiz ? `Quiz: ${m.quiz.q}` : m.text));
      })),
      G.labComplete(lab.id) ? null : el('p', { class: 'note' }, 'Open any unchecked step from the contents to finish it.'))];
  }
  $('s-body').replaceChildren(...body);
  renderBar();
}

function renderBar() {
  const { lab, steps, step } = current;
  const s = steps[step];
  const bar = $('fbar');
  const next = () => goStep(step + 1);
  const msg = (strong, sub) => el('div', { class: 'fbar-msg' }, strong ? el('strong', {}, strong) : null, sub ? el('span', {}, sub) : null);
  let cls = '', kids = [];

  if (s.type === 'learn') {
    kids = [msg(null, 'Play with the controls while you read — every change re-runs the circuit.'),
      el('button', { type: 'button', class: 'btn btn-primary', onclick: next }, 'Continue')];
  } else if (s.type === 'mission') {
    const done = G.isDone(lab.id, s.m.id), hinted = G.hintUsed(lab.id, s.m.id);
    if (done) {
      cls = 'ok';
      kids = [msg(`✓ Mission complete  +${G.reward(lab.id, s.m)} XP`, null), el('button', { type: 'button', class: 'btn btn-ok', onclick: next }, 'Continue')];
    } else {
      kids = [
        hinted ? msg(null, null) : el('button', { type: 'button', class: 'hint-btn', onclick: () => { G.useHint(lab.id, s.m.id); renderBar(); } }, '💡 Hint (−5 XP)'),
        hinted ? el('div', { class: 'fbar-msg' }, el('span', { class: 'hint-text' }, `💡 ${s.m.hint}`)) : msg(null, 'Do the task above to continue.'),
        el('button', { type: 'button', class: 'link-btn', onclick: next }, 'Skip'),
        el('button', { type: 'button', class: 'btn btn-ghost', disabled: true }, 'Continue')];
      if (hinted) kids.splice(0, 1);
    }
  } else if (s.type === 'quiz') {
    const done = G.isDone(lab.id, s.m.id);
    if (done) {
      cls = 'ok';
      kids = [msg(`✓ Correct!  +${s.m.xp} XP`, s.m.quiz.explain), el('button', { type: 'button', class: 'btn btn-ok', onclick: next }, 'Continue')];
    } else {
      if (current.wrong) cls = 'bad';
      kids = [msg(current.wrong ? 'Not quite — try another answer.' : null, current.wrong ? null : 'Pick an answer.'),
        el('button', { type: 'button', class: 'link-btn', onclick: next }, 'Skip'),
        el('button', { type: 'button', class: 'btn btn-primary', disabled: current.sel == null, onclick: () => {
          const tries = G.quizTry(lab.id, s.m.id);
          if (current.sel === s.m.quiz.answer) G.complete(lab.id, s.m, { firstTry: tries === 1, quiet: true });
          else current.wrong = true;
          renderStep();
        } }, 'Check')];
    }
  } else {
    const nextId = G.ORDER[G.ORDER.indexOf(lab.id) + 1];
    kids = [msg(null, null), el('a', { class: 'btn btn-ghost', href: '#/' }, 'Back to course'),
      nextId ? el('button', { type: 'button', class: 'btn btn-primary', onclick: () => {
        if (G.isUnlocked(nextId)) go(`#/lab/${nextId}`);
        else G.toast('🔒', 'Clear one mission here to unlock the next lab.');
      } }, `Next: ${short(labById(nextId))}  →`) : el('a', { class: 'btn btn-primary', href: '#/arena' }, 'On to the arena  →')];
  }
  bar.className = 'fbar' + (cls ? ' ' + cls : '');
  bar.replaceChildren(...kids);
}

const countGates = (ops, expand) => ops.reduce((n, op) =>
  n + (op.g === 'BARRIER' ? 0 : op.g === 'BLOCK' && expand ? countGates(op.ops, expand) : 1), 0);
const pathOf = (node, root) => { const p = []; while (node && node !== root) { p.unshift([...node.parentNode.children].indexOf(node)); node = node.parentNode; } return p; };
const nodeAt = (path, root) => path.reduce((n, i) => n?.children[i], root);

$('controls').addEventListener('change', (e) => {
  if (e.target.type !== 'range' || !current) return;
  const path = pathOf(e.target, $('controls'));
  $('controls').replaceChildren(...current.lab.controls(current.st, current.set));
  nodeAt(path, $('controls'))?.focus();
});
$('run').addEventListener('click', () => current?.set());
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && current) { e.preventDefault(); current.set(); }
  if (e.key === 'Escape' && current) go('#/');
});

// ============================================================ arena
const TOOLS = ['H', 'X', 'Y', 'Z', 'S', 'T', '●', '⌫'];
const COLS = 12;
const comp = loadComposer() || { n: 3, tool: 'H', grid: emptyGrid(3), challenge: CHALLENGES[0].id };
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
    ...CHALLENGES.map((c) => el('button', {
      type: 'button', role: 'listitem', class: 'chal' + (comp.challenge === c.id ? ' on' : '') + (solved.includes(c.id) ? ' solved' : ''), onclick: () => pickChallenge(c.id),
    }, el('span', { class: 'mark' }, solved.includes(c.id) ? '✓' : comp.challenge === c.id ? '●' : '○'), el('span', {}, c.title), el('span', { class: 'xp' }, `+${c.xp}`))),
    el('button', { type: 'button', role: 'listitem', class: 'chal' + (!comp.challenge ? ' on' : ''), onclick: () => pickChallenge(null) },
      el('span', { class: 'mark' }, '∞'), el('span', {}, 'Free play'), el('span', { class: 'xp' }, '')));
}

function renderComposer() {
  renderChallenges();
  $('palette').replaceChildren(...TOOLS.map((t) => el('button', {
    type: 'button', class: 'tool', 'aria-pressed': comp.tool === t ? 'true' : 'false', disabled: !allowedTool(t),
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

  const c = challenge();
  const preset = (name, cells) => el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => {
    comp.grid = emptyGrid(comp.n); cells.forEach(([q, col, g]) => { if (q < comp.n) comp.grid[q][col] = g; }); update();
  } }, name);
  $('composer-actions').replaceChildren(
    ...(c ? [] : [
      el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => resize(1), disabled: comp.n >= 6 }, '+ qubit'),
      el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => resize(-1), disabled: comp.n <= 1 }, '− qubit'),
      preset('Bell pair', [[0, 0, 'H'], [0, 1, '●'], [1, 1, 'X']]),
      preset('GHZ', [[0, 0, 'H'], [0, 1, '●'], [1, 1, 'X'], [1, 2, '●'], [2, 2, 'X']])]),
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
      el('span', {}, `|${i.toString(2).padStart(comp.n, '0')}⟩`),
      el('span', { class: 'sv-bar' }, el('span', { style: `width:${p * 100}%;background:hsl(${(220 + ang + 360) % 360} 70% 55%)` })),
      el('span', { class: 'sv-v' }, `${(p * 100).toFixed(1)}% ∠${ang.toFixed(0)}°`)));
  }
  $('statevec').replaceChildren(el('div', { class: 'sv' }, ...rows.slice(0, 32)),
    el('div', { class: 'sv-note' }, `Bar = probability · colour and angle = phase. Basis states read q${comp.n - 1} … q0. Right-click a cell to erase.`));

  const c = challenge();
  if (!c) {
    $('goal').replaceChildren(el('p', { class: 'eyebrow' }, 'Free play'), el('div', { class: 'goal-text' }, 'Build anything.'));
    return;
  }
  // overlap with the target, ignoring global phase
  let re = 0, im = 0;
  for (const [k, tr, ti] of c.target) { re += tr * s.re[k] + ti * s.im[k]; im += tr * s.im[k] - ti * s.re[k]; }
  const match = re * re + im * im;
  const legal = !c.allowed || comp.grid.flat().filter(Boolean).every((g) => c.allowed.includes(g));
  const solved = match > 0.999 && legal;
  if (solved && G.completeChallenge(c)) renderChallenges();
  $('goal').replaceChildren(
    el('p', { class: 'eyebrow' }, `Puzzle · ${c.title} · +${c.xp} XP`),
    el('div', { class: 'goal-text' }, c.goal),
    el('div', { class: 'meter' + (solved ? ' ok' : '') }, el('span', { style: `width:${match * 100}%` })),
    el('div', { class: 'note' }, solved ? '✓ Solved — pick another puzzle.' : !legal ? `Only ${c.allowed.join(' and ')} gates are allowed here.` : `Match with target: ${(match * 100).toFixed(0)}%`));
}

// ============================================================ boot
G.onChange(() => { renderHud(); if (!$('view-course').hidden) renderCourse(); });
renderHud();
// old links (#lab/<id>) still work
if (/^#lab\//.test(location.hash)) history.replaceState(null, '', '#/' + location.hash.slice(1));
route();
