// Creates or updates a help language glossary: web/src/lang/words/<code>.json
// Usage: node scripts/word-list.mjs <code>   (run `cd web && npm run build` first)
// Lists every word of the questions and choices, as { "fête": "" }: fill in the translation.
// Running it again after new questions keeps the translations already done, and drops unused words.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const code = process.argv[2];
if (!code || !/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(code) || code === 'fr') {
  console.error('Usage: node scripts/word-list.mjs <code>');
  process.exit(1);
}
const web = join(dirname(fileURLToPath(import.meta.url)), '..', 'web');
const { tokenize, wordKey } = await import(pathToFileURL(join(web, 'src', 'lib', 'words.js')).href);
const questions = JSON.parse(readFileSync(join(web, 'src', 'data', 'questions.json'), 'utf8'));

const keys = new Set();
for (const q of questions) {
  for (const t of [q.q, ...q.o]) for (const tk of tokenize(t)) if (tk.word) keys.add(wordKey(tk.text));
}
const file = join(web, 'src', 'lang', 'words', `${code}.json`);
const old = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
const out = {};
let done = 0;
for (const k of [...keys].sort((a, b) => a.localeCompare(b, 'fr'))) {
  out[k] = old[k] || '';
  if (out[k]) done++;
}
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(`${file}: ${done} / ${keys.size} words translated`);
