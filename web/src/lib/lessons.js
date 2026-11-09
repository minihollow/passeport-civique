import RAW_LESSONS from '../data/lessons.json';

// Lessons (one per sub-theme), written in French in content/lessons.json.
// Each text becomes a [French, help language] pair, filled from the help language pack (see lang/langs.js).
const pair = (fr) => [fr, fr];
export const LESSONS = RAW_LESSONS.map((l) => ({
  ...l,
  intro: pair(l.intro),
  parts: l.parts.map((p) => ({ h: pair(p.h), p: p.p.map(pair) })),
  keys: l.keys.map(pair),
  v: l.v.map(pair),
}));

export const lessonOf = (t, s) => LESSONS.find((l) => l.t === t && l.s === s) || null;
