// Help languages. Every text in the app is a pair [French, help language].
// Turkish is written directly in the code and content (2nd slot of the pairs).
// Another language is a JSON pack (packs/xx.json) that replaces the 2nd slot at startup.
// Create or update a pack: node scripts/lang-template.mjs xx (see CONTRIBUTING.md).
import { UI } from '../data/i18n.js';
import { THEMES } from '../data/themes.js';
import { BADGES, QUESTIONS } from '../lib/quiz.js';
import { MODELS } from '../lib/ai.js';

// name: name in the language itself; nameFr: name in French (Coco's instructions are in French);
// locale: dates and reading voice; dir: 'ltr' or 'rtl'; flag: drawn flag (otherwise the code is shown).
// A new language: its pack in packs/<code>.json, then one line here, for example
//   ar: { name: 'العربية', nameFr: 'arabe', locale: 'ar', dir: 'rtl' },
const ALL = {
  tr: { name: 'Türkçe', nameFr: 'turc', locale: 'tr-TR', dir: 'ltr', flag: 'tr' },
};
const PACKS = import.meta.glob('./packs/*.json');
// Languages offered: Turkish, and those that have a pack.
export const LANGS = Object.fromEntries(Object.entries(ALL).filter(([c]) => c === 'tr' || PACKS[`./packs/${c}.json`]));

let help = 'tr';
export const helpLang = () => help;
export const helpInfo = () => LANGS[help] || LANGS.tr;

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
  return out;
}

let original = null; // original Turkish texts, to switch back to Turkish
// Apply a profile's help language. Text missing from the pack: French is kept.
export async function applyLang(code) {
  if (!LANGS[code]) code = 'tr';
  const pairs = allPairs();
  if (!original) original = new Map(pairs.map(([k, p]) => [k, p[1]]));
  let pack = null;
  if (code !== 'tr') pack = (await PACKS[`./packs/${code}.json`]()).default;
  for (const [k, p] of pairs) {
    if (!pack) { p[1] = original.get(k) ?? p[1]; continue; }
    const e = pack[k];
    const text = typeof e === 'string' ? e : e?.[code];
    p[1] = text?.trim() ? text : p[0];
  }
  help = code;
  const meta = LANGS[code];
  UI.mode_tr = [meta.name, meta.name];
  return code;
}
