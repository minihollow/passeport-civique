// Word by word: cut a French text into words, and the key of a word in the glossaries
// (web/src/lang/words/<code>.json, filled by scripts/word-list.mjs).
// No imports: also used by the Node scripts.

// A word: letters, possibly joined by an apostrophe or a hyphen (l'égalité, outre-mer).
const WORD = /[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu;
// Elided articles and pronouns: "l'égalité" is looked up as "égalité".
const ELISION = /^(?:l|d|j|n|s|c|m|t|qu|jusqu|lorsqu|puisqu|quoiqu)'(?=[\p{L}])/u;

// [{ text, word: true|false }]: words and what lies between them (spaces, punctuation, numbers).
export function tokenize(text) {
  const out = [];
  let last = 0;
  for (const m of String(text).matchAll(WORD)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), word: false });
    out.push({ text: m[0], word: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), word: false });
  return out;
}

export function wordKey(w) {
  return w.toLowerCase().replace(/’/g, "'").replace(ELISION, '');
}
