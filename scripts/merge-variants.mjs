// Adds choice variants (oc = other right answers, od = other wrong answers)
// to a content file, right after each question's "o" line, leaving the rest untouched.
// Usage: node scripts/merge-variants.mjs content/pv.json variants.json
import { readFileSync, writeFileSync } from 'node:fs';

const [file, varFile] = process.argv.slice(2);
const variants = JSON.parse(readFileSync(varFile, 'utf8'));
const lines = readFileSync(file, 'utf8').split('\n');
const out = [];
let id = null;
const done = new Set();
for (const line of lines) {
  const m = line.match(/^\{"id":"([^"]+)"/);
  if (m) id = m[1];
  if (/^ "o[cd]":/.test(line) && variants[id]) continue; // this question's previous variants: replaced
  out.push(line);
  if (id && /^ "o":/.test(line) && variants[id]) {
    for (const k of ['oc', 'od']) if (variants[id][k]?.length) out.push(` "${k}":${JSON.stringify(variants[id][k])},`);
    done.add(id);
  }
}
const missing = Object.keys(variants).filter((k) => !done.has(k));
if (missing.length) throw new Error('questions not found: ' + missing.join(', '));
writeFileSync(file, out.join('\n'));
JSON.parse(out.join('\n')); // the file must stay valid JSON
console.log(`${done.size} questions updated in ${file}`);
