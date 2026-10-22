// Progress, XP, levels, badges and feedback toasts. Progress is kept per browser in localStorage.

import { MISSIONS, LAB_BADGES, SPECIAL_BADGES, CHALLENGES, LEVELS, CHAPTERS } from './missions.js';
import { el } from './ui.js';
import { t } from './i18n.js';

const KEY = 'ql-progress-v1';
const LAB_BONUS = 50;
const blank = () => ({ xp: 0, done: {}, hints: {}, badges: [], unlocked: [], arena: [], firstTry: 0, tries: {} });

let P = load();
const listeners = new Set();

function load() {
  try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return blank(); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(P)); } catch { /* storage unavailable: progress lasts for this visit */ }
  listeners.forEach((fn) => fn());
}
export const onChange = (fn) => listeners.add(fn);
export const state = () => P;
export function reset() { P = blank(); save(); }

export const ORDER = CHAPTERS.flatMap((c) => c.labs);
export const chapterOf = (id) => CHAPTERS.findIndex((c) => c.labs.includes(id));

export function level(xp = P.xp) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++;
  const [floor, name] = LEVELS[i];
  const next = LEVELS[i + 1];
  return { i: i + 1, name, floor, next: next?.[0], nextName: next?.[1], pct: next ? (xp - floor) / (next[0] - floor) : 1 };
}

export const doneList = (lab) => P.done[lab] || [];
export const isDone = (lab, id) => doneList(lab).includes(id);
export const labTotal = (lab) => MISSIONS[lab].length;
export const labComplete = (lab) => doneList(lab).length >= labTotal(lab);
export const stars = (lab) => Math.floor((3 * doneList(lab).length) / labTotal(lab));
export const hintUsed = (lab, id) => !!P.hints[`${lab}/${id}`];
export const labXp = (lab) => MISSIONS[lab].reduce((a, m) => a + (isDone(lab, m.id) ? reward(lab, m) : 0), 0);
export const labXpMax = (lab) => MISSIONS[lab].reduce((a, m) => a + m.xp, 0);
export const reward = (lab, m) => Math.max(5, m.xp - (hintUsed(lab, m.id) ? 5 : 0));

export function isUnlocked(lab) {
  const i = ORDER.indexOf(lab);
  return i <= 0 || P.unlocked.includes(lab) || doneList(ORDER[i - 1]).length > 0 || doneList(lab).length > 0;
}
export function unlock(lab) { if (!P.unlocked.includes(lab)) { P.unlocked.push(lab); save(); } }
export function nextUp() {
  return ORDER.find((id) => isUnlocked(id) && !labComplete(id)) || ORDER[ORDER.length - 1];
}

export function useHint(lab, id) { P.hints[`${lab}/${id}`] = true; save(); }

function addXp(n) {
  const before = level().i;
  P.xp += n;
  const after = level();
  if (after.i > before) {
    toast(t('Level {i}', { i: after.i }), t('You are now a <b>{name}</b>', { name: after.name }), 'level');
  }
}

export function badgeInfo(id) {
  if (LAB_BADGES[id]) return LAB_BADGES[id];
  return SPECIAL_BADGES[id];
}
export const ALL_BADGES = [...Object.keys(LAB_BADGES), ...Object.keys(SPECIAL_BADGES)];
function award(id) {
  if (P.badges.includes(id)) return;
  P.badges.push(id);
  const [emoji, name] = badgeInfo(id);
  toast(emoji, t('Badge unlocked: <b>{name}</b>', { name }), 'badge');
}

// Mark a mission done; returns true if this call completed it.
export function complete(lab, m, { firstTry, quiet } = {}) {
  if (isDone(lab, m.id)) return false;
  (P.done[lab] ||= []).push(m.id);
  const xp = reward(lab, m);
  if (!quiet) toast(`+${xp} XP`, m.quiz ? t('Correct!') : t('Mission complete — {text}', { text: m.text }), 'xp');
  addXp(xp);
  if (!P.badges.includes('first')) award('first');
  if (m.badge) award(m.badge);
  if (m.quiz && firstTry && ++P.firstTry >= 5) award('sharp');
  if (labComplete(lab)) {
    toast('★★★', t('Lab complete! +{xp} XP bonus', { xp: LAB_BONUS }), 'level');
    addXp(LAB_BONUS);
    award(lab);
  }
  save();
  return true;
}

export function quizTry(lab, id) { const k = `${lab}/${id}`; P.tries[k] = (P.tries[k] || 0) + 1; save(); return P.tries[k]; }
export const quizTries = (lab, id) => P.tries[`${lab}/${id}`] || 0;

export function completeChallenge(c) {
  // returns true only the first time a puzzle is solved
  if (P.arena.includes(c.id)) return false;
  P.arena.push(c.id);
  toast(`+${c.xp} XP`, t('Challenge solved — {title}', { title: c.title }), 'xp');
  addXp(c.xp);
  if (P.arena.length === CHALLENGES.length) award('arena');
  save();
  return true;
}

// ---------- feedback ----------
let toastBox;
export function toast(big, small, kind = 'xp') {
  toastBox ??= document.body.appendChild(el('div', { class: 'toasts', 'aria-live': 'polite' }));
  const node = el('div', { class: `toast toast-${kind}` }, el('span', { class: 'toast-big' }, big), el('span', { class: 'toast-small', html: small }));
  toastBox.append(node);
  setTimeout(() => node.classList.add('out'), 3200);
  setTimeout(() => node.remove(), 3700);
}

