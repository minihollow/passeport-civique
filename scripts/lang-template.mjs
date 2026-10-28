// Creates or updates a help language pack: web/src/lang/packs/<code>.json
// Usage: node scripts/lang-template.mjs ar "العربية" arabe ar
//   (code, name in the language, name in French, locale for dates and voice)
// Each text becomes { "fr": …, "tr": …, "<code>": "" }: just fill in the "<code>" slot.
// Running it again after new questions keeps the translations already done.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [code, name, nameFr, locale] = process.argv.slice(2);
if (!code || !/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(code) || code === 'tr' || code === 'fr') {
  console.error('Usage: node scripts/lang-template.mjs <code> "<name>" "<name in French>" <locale>');
  process.exit(1);
}
const web = join(dirname(fileURLToPath(import.meta.url)), '..', 'web');
const { createServer } = await import(pathToFileURL(join(web, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
const server = await createServer({ root: web, logLevel: 'error', server: { middlewareMode: true } });
const { allPairs } = await server.ssrLoadModule('/src/lang/langs.js');

const file = join(web, 'src', 'lang', 'packs', `${code}.json`);
const old = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
const pack = { _meta: { ...(old._meta || {}), ...(name && { name }), ...(nameFr && { nameFr }), ...(locale && { locale }) } };
pack._meta.name ??= code;
pack._meta.nameFr ??= code;
pack._meta.locale ??= code;
let done = 0;
const pairs = allPairs().filter(([k]) => k !== 'ui.mode_tr'); // language name: _meta.name
for (const [k, [fr, tr]] of pairs) {
  const prev = old[k];
  // French text changed since it was translated: the translation must be redone.
  const text = typeof prev === 'string' ? prev : prev?.fr === fr ? prev[code] || '' : '';
  if (text) done++;
  pack[k] = { fr, tr, [code]: text };
}
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(pack, null, 1) + '\n');
console.log(`${file}: ${done} / ${pairs.length} texts translated`);
const m = pack._meta;
console.log(`To offer the language, add this line to web/src/lang/langs.js (ALL):\n  '${code}': { name: '${m.name}', nameFr: '${m.nameFr}', locale: '${m.locale}', dir: 'ltr' },`);
await server.close();
