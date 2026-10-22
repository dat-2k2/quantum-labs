import './localize.js';
import { LABS } from './labs.js';
import { drawCircuit } from './viz.js';
import { run } from './sim.js';
import { el } from './ui.js';
import { CHAPTERS, MISSIONS, CHALLENGES } from './missions.js';
import * as G from './game.js';
import { t, lang, setLang, translateDom } from './i18n.js';

const $ = (id) => document.getElementById(id);
const labById = (id) => LABS.find((l) => l.id === id);
const short = (lab) => lab.short || lab.title.replace('’s Algorithm', '').replace(': factor 15', '');
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
  $('hud').textContent = t('{xp} XP · Level {lv}', { xp: G.state().xp, lv: lv.i });
}

let lockOpen = null;
function renderCourse() {
  const st = G.state(), next = labById(G.nextUp());
  const started = st.xp > 0;
  $('cta').textContent = started ? t('Continue: {lab}  →', { lab: short(next) }) : t('Start the first lab  →');
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
        const label = t(complete ? 'Review' : !unlocked ? 'Locked' : n ? 'Continue lab' : 'Start');
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
            el('span', {}, t('Clear one mission in {lab} to unlock.', { lab: short(prev) })),
            el('button', { type: 'button', class: 'link-btn', onclick: () => { G.unlock(id); lockOpen = null; go(`#/lab/${id}`); } }, t('Unlock now →'))) : null);
      }));
  }), el('section', { class: 'chapter' },
    el('div', { class: 'chapter-head' }, el('span', { class: 'num' }, '++'), el('h2', {}, t('Practice')),
      el('span', { class: 'count' }, `${st.arena.length}/${CHALLENGES.length}`)),
    el('div', { class: 'row', onclick: () => go('#/arena') },
      el('span', { class: 'ring' + (st.arena.length === CHALLENGES.length ? ' done' : ''), style: `--p:${(100 * st.arena.length) / CHALLENGES.length}` }),
      el('div', {}, el('div', { class: 'row-title' }, t('Arena: circuit puzzles')), el('div', { class: 'row-desc' }, t('Build Bell pairs, GHZ states and more from scratch'))),
      el('span', { class: 'row-count' }, `${st.arena.length}/${CHALLENGES.length}`),
      el('button', { type: 'button', class: 'btn btn-sm btn-ghost' }, t('Open')))));

  const lv = G.level();
  const labsDone = G.ORDER.filter(G.labComplete).length;
  const missions = G.ORDER.reduce((a, id) => a + G.doneList(id).length, 0);
  const totalMissions = G.ORDER.reduce((a, id) => a + G.labTotal(id), 0);
  $('side').replaceChildren(
    el('div', { class: 'side-level' },
      el('div', { class: 'field-label' }, t('Level {n}', { n: lv.i })), el('div', { class: 'name' }, lv.name),
      el('div', { class: 'meter' }, el('span', { style: `width:${lv.pct * 100}%` })),
      el('div', { class: 'mono-sm' }, lv.next ? t('{xp} / {next} XP to {name}', { xp: st.xp, next: lv.next, name: lv.nextName }) : t('{xp} XP — top level', { xp: st.xp }))),
    el('dl', { class: 'stats' }, ...[
      ['Labs completed', `${labsDone} / ${G.ORDER.length}`], ['Missions', `${missions} / ${totalMissions}`],
      ['Badges', `${st.badges.length} / ${G.ALL_BADGES.length}`], ['Arena puzzles', `${st.arena.length} / ${CHALLENGES.length}`],
    ].map(([k, v]) => el('div', {}, el('dt', {}, t(k)), el('dd', {}, v)))),
    el('div', { class: 'side-level' }, el('div', { class: 'field-label' }, t('Badges')),
      el('div', { class: 'badge-list' }, ...G.ALL_BADGES.map((id) => {
        const [emoji, name] = G.badgeInfo(id), got = st.badges.includes(id);
        return el('span', { class: 'badge' + (got ? ' got' : ''), title: got ? name : t('{name} — locked', { name }), 'aria-label': got ? name : t('{name} (locked)', { name }) }, emoji);
      }))),
    el('button', { type: 'button', class: 'reset', onclick: () => { if (confirm(t('Reset all progress? Your XP, missions and badges will be erased.'))) { G.reset(); renderCourse(); } } }, t('Reset progress')));
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

function goStep(i) {
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
  $('circuit-tag').textContent = t(res.n === 1 ? '{n} qubit · {g} ops' : '{n} qubits · {g} ops', { n: res.n, g: countGates(res.ops, res.expand) });
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

  // top bar
  $('segs').replaceChildren(...steps.slice(0, -1).map((x, i) => el('span', {
    class: stepDone(x) ? 'on' : i === step ? 'here' : '',
  })));
  $('lxp').textContent = `⚡ ${G.state().xp}`;

  // contents
  const stepLabel = (x) => x.type === 'learn' ? t('Lesson') : x.type === 'done' ? t('Summary')
    : x.type === 'quiz' ? t('Quiz {n}', { n: quizzes.indexOf(x) + 1 }) : t('Mission {n}', { n: actions.indexOf(x) + 1 });
  const nextId = G.ORDER[G.ORDER.indexOf(lab.id) + 1];
  $('toc').replaceChildren(
    el('p', { class: 'eyebrow' }, `${String(ci + 1).padStart(2, '0')} · ${CHAPTERS[ci].name}`),
    el('div', { class: 'toc-lab' }, lab.title),
    ...steps.map((x, i) => el('button', { type: 'button', class: i === step ? 'here' : '', onclick: () => goStep(i) },
      el('span', { class: 'mark' + (stepDone(x) ? ' ok' : '') }, stepDone(x) ? '✓' : i === step ? '●' : '○'),
      el('span', {}, stepLabel(x)))),
    el('div', { class: 'toc-next' }, t('Next: '), nextId ? el('a', { href: `#/lab/${nextId}` }, labById(nextId).title) : el('a', { href: '#/arena' }, t('Arena puzzles'))));

  // stage
  $('ws').hidden = s.type === 'quiz' || s.type === 'done';
  const eyebrow = { learn: t('Lesson · {lab}', { lab: lab.title }), mission: t('Mission {i} of {n} · {lab}', { i: actions.indexOf(s) + 1, n: actions.length, lab: lab.title }),
    quiz: t('Quiz · {lab}', { lab: lab.title }), done: t('Summary · {lab}', { lab: lab.title }) }[s.type];
  $('s-eyebrow').textContent = eyebrow;
  $('s-title').textContent = s.type === 'learn' ? lab.desc : s.type === 'mission' ? s.m.text : s.type === 'quiz' ? s.m.quiz.q
    : t(G.labComplete(lab.id) ? 'Lab complete.' : 'Almost there.');

  let body = [];
  if (s.type === 'learn') {
    body = [el('ol', { class: 'lesson-steps' }, ...lab.steps.map(([title, d], i) => el('li', {},
      el('span', { class: 'n' }, String(i + 1)), el('div', {}, el('h4', {}, title), el('p', {}, d)))))];
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
      el('div', { class: 'big', 'aria-label': t('{n} of 3 stars', { n: G.stars(lab.id) }) }, starStr(G.stars(lab.id))),
      el('div', { class: 'muted' }, t('{xp} of {max} XP earned', { xp: G.labXp(lab.id), max: G.labXpMax(lab.id) })
        + (G.labComplete(lab.id) ? t(' · badge: {badge}', { badge: G.badgeInfo(lab.id).join(' ') }) : '')),
      el('ul', {}, ...ms.map((m) => {
        const d = G.isDone(lab.id, m.id), at = steps.findIndex((x) => x.m === m);
        const label = m.quiz ? t('Quiz: {q}', { q: m.quiz.q }) : m.text;
        return el('li', { class: d ? 'ok' : '' }, el('span', { class: 'mark' }, d ? '✓' : '○'),
          d ? el('span', {}, label) : el('button', { type: 'button', class: 'link-btn summary-link', onclick: () => goStep(at) }, label));
      })),
      G.labComplete(lab.id) ? null : el('p', { class: 'note' }, t('Choose an unfinished step to complete it.')))];
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
    kids = [msg(null, t('Play with the controls while you read — every change re-runs the circuit.')),
      el('button', { type: 'button', class: 'btn btn-primary', onclick: next }, t('Continue'))];
  } else if (s.type === 'mission') {
    const done = G.isDone(lab.id, s.m.id), hinted = G.hintUsed(lab.id, s.m.id);
    if (done) {
      cls = 'ok';
      kids = [msg(t('✓ Mission complete  +{xp} XP', { xp: G.reward(lab.id, s.m) }), null), el('button', { type: 'button', class: 'btn btn-ok', onclick: next }, t('Continue'))];
    } else {
      kids = [
        hinted ? msg(null, null) : el('button', { type: 'button', class: 'hint-btn', onclick: () => { G.useHint(lab.id, s.m.id); renderBar(); } }, t('💡 Hint (−5 XP)')),
        hinted ? el('div', { class: 'fbar-msg' }, el('span', { class: 'hint-text' }, `💡 ${s.m.hint}`)) : msg(null, t('Do the task above to continue.')),
        el('button', { type: 'button', class: 'link-btn', onclick: next }, t('Skip')),
        el('button', { type: 'button', class: 'btn btn-ghost', disabled: true }, t('Continue'))];
      if (hinted) kids.splice(0, 1);
    }
  } else if (s.type === 'quiz') {
    const done = G.isDone(lab.id, s.m.id);
    if (done) {
      cls = 'ok';
      kids = [msg(t('✓ Correct!  +{xp} XP', { xp: s.m.xp }), s.m.quiz.explain), el('button', { type: 'button', class: 'btn btn-ok', onclick: next }, t('Continue'))];
    } else {
      if (current.wrong) cls = 'bad';
      kids = [msg(current.wrong ? t('Not quite — try another answer.') : null, current.wrong ? null : t('Pick an answer.')),
        el('button', { type: 'button', class: 'link-btn', onclick: next }, t('Skip')),
        el('button', { type: 'button', class: 'btn btn-primary', disabled: current.sel == null, onclick: () => {
          const tries = G.quizTry(lab.id, s.m.id);
          if (current.sel === s.m.quiz.answer) G.complete(lab.id, s.m, { firstTry: tries === 1, quiet: true });
          else current.wrong = true;
          renderStep();
        } }, t('Check'))];
    }
  } else {
    const nextId = G.ORDER[G.ORDER.indexOf(lab.id) + 1];
    kids = [msg(null, null), el('a', { class: 'btn btn-ghost', href: '#/' }, t('Back to course')),
      nextId ? el('button', { type: 'button', class: 'btn btn-primary', onclick: () => {
        if (G.isUnlocked(nextId)) go(`#/lab/${nextId}`);
        else G.toast('🔒', t('Clear one mission here to unlock the next lab.'));
      } }, t('Next: {lab}  →', { lab: short(labById(nextId)) })) : el('a', { class: 'btn btn-primary', href: '#/arena' }, t('On to the arena  →'))];
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
const allowedTool = (g) => { const c = challenge(); return !c?.allowed || g === '⌫' || c.allowed.includes(g); };

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
      el('span', { class: 'mark' }, '∞'), el('span', {}, t('Free play')), el('span', { class: 'xp' }, '')));
}

function renderComposer() {
  renderChallenges();
  $('palette').replaceChildren(...TOOLS.map((g) => el('button', {
    type: 'button', class: 'tool', 'aria-pressed': comp.tool === g ? 'true' : 'false', disabled: !allowedTool(g),
    title: g === '⌫' ? t('Eraser') : g === '●' ? t('Control dot') : t('{g} gate', { g }), onclick: () => { comp.tool = g; renderComposer(); },
  }, g)));

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
        type: 'button', class: 'slot' + cls, 'aria-label': t('q{q} column {c}', { q, c: c + 1 }) + (g ? ': ' + g : ''),
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
      preset(t('Bell pair'), [[0, 0, 'H'], [0, 1, '●'], [1, 1, 'X']]),
      preset('GHZ', [[0, 0, 'H'], [0, 1, '●'], [1, 1, 'X'], [1, 2, '●'], [2, 2, 'X']])]),
    el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => { comp.grid = emptyGrid(comp.n); update(); } }, t('Clear')));
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
    el('div', { class: 'sv-note' }, t('Bar = probability · colour and angle = phase. Basis states read q{top} … q0. Right-click a cell to erase.', { top: comp.n - 1 })));

  const c = challenge();
  if (!c) {
    $('goal').replaceChildren(el('p', { class: 'eyebrow' }, t('Free play')), el('div', { class: 'goal-text' }, t('Build anything.')));
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
    el('p', { class: 'eyebrow' }, t('Puzzle · {title} · +{xp} XP', { title: c.title, xp: c.xp })),
    el('div', { class: 'goal-text' }, c.goal),
    el('div', { class: 'meter' + (solved ? ' ok' : '') }, el('span', { style: `width:${match * 100}%` })),
    el('div', { class: 'note' }, solved ? t('✓ Solved — pick another puzzle.') : !legal ? t('Only {gates} gates are allowed here.', { gates: c.allowed.join(t(' and ')) }) : t('Match with target: {p}%', { p: (match * 100).toFixed(0) })));
}

// ============================================================ boot
translateDom();
document.title = t('Quantum Labs — quantum algorithms, hands on');
const other = lang === 'vi' ? 'en' : 'vi';
for (const btn of document.querySelectorAll('.lang-switch')) {
  btn.textContent = other === 'vi' ? 'Tiếng Việt' : 'English';
  btn.lang = other;
  btn.setAttribute('aria-label', t(other === 'vi' ? 'Switch to Vietnamese' : 'Switch to English'));
  btn.addEventListener('click', () => setLang(other));
}
G.onChange(() => { renderHud(); if (!$('view-course').hidden) renderCourse(); });
renderHud();
// old links (#lab/<id>) still work
if (/^#lab\//.test(location.hash)) history.replaceState(null, '', '#/' + location.hash.slice(1));
route();
