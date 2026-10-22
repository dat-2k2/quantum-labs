// Swap course content (lab text, missions, badges, puzzles, levels) into the active language.
// Imported once by app.js before anything renders; English needs no work.

import { lang } from './i18n.js';
import { VI } from './i18n.vi.js';
import { LABS } from './labs.js';
import { CHAPTERS, MISSIONS, LAB_BADGES, SPECIAL_BADGES, CHALLENGES, LEVELS } from './missions.js';

if (lang === 'vi') {
  for (const lab of LABS) Object.assign(lab, VI.labs[lab.id] || {});
  CHAPTERS.forEach((c, i) => { c.name = VI.chapters[i] ?? c.name; });
  for (const [labId, list] of Object.entries(MISSIONS)) {
    for (const m of list) {
      const v = VI.missions[labId]?.[m.id];
      if (!v) continue;
      if (v.text) m.text = v.text;
      if (v.hint) m.hint = v.hint;
      if (v.quiz) m.quiz = { ...m.quiz, ...v.quiz };
    }
  }
  for (const table of [LAB_BADGES, SPECIAL_BADGES]) {
    for (const id of Object.keys(table)) if (VI.badges[id]) table[id][1] = VI.badges[id];
  }
  for (const c of CHALLENGES) Object.assign(c, VI.challenges[c.id] || {});
  LEVELS.forEach((l, i) => { l[1] = VI.levels[i] ?? l[1]; });
}
