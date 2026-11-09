// Help languages. The app's texts are written in French (content/, data/i18n.js…) and become
// [French, help language] pairs at runtime. Each help language is a JSON pack (packs/<code>.json)
// that fills the 2nd slot when a profile uses it; only that pack is loaded.
// Create or update a pack: node scripts/lang-template.mjs <code> (see CONTRIBUTING.md).
import { UI } from '../data/i18n.js';
import { THEMES } from '../data/themes.js';
import { BADGES, QUESTIONS } from '../lib/quiz.js';
import { MODELS } from '../lib/ai.js';
import { LESSONS } from '../lib/lessons.js';

// name: name in the language itself; nameFr: name in French (Coco's instructions are in French);
// locale: dates and reading voice; dir: 'ltr' or 'rtl'; flag: drawn flag (otherwise the code is shown).
// A new language: its pack in packs/<code>.json, then one line here, for example
//   ar: { name: 'العربية', nameFr: 'arabe', locale: 'ar', dir: 'rtl' },
const ALL = {
  tr: { name: 'Türkçe', nameFr: 'turc', locale: 'tr-TR', dir: 'ltr', flag: 'tr' },
  en: { name: 'English', nameFr: 'anglais', locale: 'en-GB', dir: 'ltr', flag: 'gb' },
};
const PACKS = import.meta.glob('./packs/*.json');
// Word by word glossaries (words/<code>.json, see scripts/word-list.mjs), loaded with the pack.
const WORDS = import.meta.glob('./words/*.json');
let words = {};
export const wordTr = (key) => words[key] || '';
// Languages offered: those that have a pack.
export const LANGS = Object.fromEntries(Object.entries(ALL).filter(([c]) => PACKS[`./packs/${c}.json`]));

let help = null; // help language applied to the texts (null until the first applyLang)
export const helpLang = () => help;
export const helpInfo = () => LANGS[help] || Object.values(LANGS)[0];

// Language for a new visitor: the first browser language we have, otherwise English, otherwise the first one.
export function defaultLang() {
  const wanted = (navigator.languages || [navigator.language || '']).map((l) => l.slice(0, 2).toLowerCase());
  return wanted.find((c) => LANGS[c]) || (LANGS.en ? 'en' : Object.keys(LANGS)[0]);
}

// All translatable pairs, with a stable key (ui.xxx, themes.pv.symboles, q.pv01.o.2…).
const isPair = (v) => Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && typeof v[1] === 'string';
function walk(v, path, out) {
  if (isPair(v)) { out.push([path, v]); return; }
  if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${path}.${x && typeof x === 'object' && !Array.isArray(x) && x.id ? x.id : i}`, out)); return; }
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'id') walk(x, `${path}.${k}`, out);
}
export function allPairs() {
  const out = [];
  walk(UI, 'ui', out);
  walk(THEMES, 'themes', out);
  walk(BADGES, 'badges', out);
  walk(MODELS, 'models', out);
  for (const q of QUESTIONS) walk({ q: q.q, o: q.o, x: q.x, v: q.v }, `q.${q.id}`, out);
  for (const l of LESSONS) walk({ intro: l.intro, parts: l.parts, keys: l.keys, v: l.v }, `lesson.${l.t}.${l.s}`, out);
  return out;
}

// Apply a profile's help language. Text missing from the pack: French is kept.
export async function applyLang(code) {
  if (!LANGS[code]) code = defaultLang();
  const pack = (await PACKS[`./packs/${code}.json`]()).default;
  const glossary = WORDS[`./words/${code}.json`];
  words = glossary ? (await glossary()).default : {};
  for (const [k, p] of allPairs()) {
    const e = pack[k];
    const text = typeof e === 'string' ? e : e?.[code];
    p[1] = text?.trim() ? text : p[0];
  }
  help = code;
  const meta = LANGS[code];
  UI.mode_tr = [meta.name, meta.name];
  return code;
}
