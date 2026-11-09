// Merges the content files (French) into a single JSON for the app.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = [];
for (const t of ['pv', 'sip', 'dd', 'hgc', 'vsf']) {
  for (const q of JSON.parse(readFileSync(join(root, 'content', `${t}.json`), 'utf8'))) {
    out.push({ ...q, t, k: 'know' });
  }
}
for (const q of JSON.parse(readFileSync(join(root, 'content', 'situ.json'), 'utf8'))) {
  out.push({ ...q, k: 'situ' });
}
const ids = new Set();
for (const q of out) {
  if (ids.has(q.id)) throw new Error('duplicate id ' + q.id);
  ids.add(q.id);
  if (q.o.length !== 4) throw new Error('4 options expected ' + q.id);
  // Optional variants: oc = other right answers, od = other wrong answers.
  // The 4 base choices keep their indexes (0 = right answer), variants are appended after them:
  // already saved history stays valid.
  const oc = q.oc || [];
  const od = q.od || [];
  // Texts are French strings; translations live in the help language packs (web/src/lang/packs/).
  for (const t of [q.q, q.x, ...q.o, ...oc, ...od, ...(q.v || [])]) {
    if (typeof t !== 'string' || !t.trim()) throw new Error('empty or invalid text in ' + q.id + ': ' + JSON.stringify(t));
  }
  const all = [...q.o, ...od, ...oc];
  const seen = new Set();
  for (const fr of all) {
    const k = fr.toLowerCase().trim();
    if (seen.has(k)) throw new Error(`duplicate choice ${q.id}: ${fr}`);
    seen.add(k);
  }
  delete q.oc;
  delete q.od;
  q.o = all;
  if (oc.length) q.good = oc.map((_, i) => 4 + od.length + i);
}
const dest = join(root, 'web', 'src', 'data', 'questions.json');
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(out));
console.log(`${out.length} questions -> ${dest}`);

// Lessons: one per sub-theme, read on the "Lire le cours" page.
const lessons = JSON.parse(readFileSync(join(root, 'content', 'lessons.json'), 'utf8'));
const subs = new Set(out.map((q) => `${q.t}.${q.s}`));
const seenLessons = new Set();
for (const l of lessons) {
  const key = `${l.t}.${l.s}`;
  if (!subs.has(key)) throw new Error('lesson for an unknown sub-theme: ' + key);
  if (seenLessons.has(key)) throw new Error('duplicate lesson ' + key);
  seenLessons.add(key);
  if (!l.parts?.length) throw new Error('lesson without parts: ' + key);
  for (const t of [l.intro, ...l.parts.flatMap((p) => [p.h, ...(p.p || [])]), ...(l.keys || []), ...(l.v || [])]) {
    if (typeof t !== 'string' || !t.trim()) throw new Error('empty or invalid text in lesson ' + key + ': ' + JSON.stringify(t));
  }
}
const lessonsDest = join(root, 'web', 'src', 'data', 'lessons.json');
writeFileSync(lessonsDest, JSON.stringify(lessons));
console.log(`${lessons.length} lessons -> ${lessonsDest}`);
