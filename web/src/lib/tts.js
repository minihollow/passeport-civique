// Reading aloud.
// - Natural voice: Piper (open source), computed in the browser. One voice per language (≈ 63 MB),
//   downloaded once from Hugging Face and kept on the device: then it works offline.
// - Otherwise, or if the voice is not downloaded: browser / system voice.
let voices = [];
function refresh() { try { voices = window.speechSynthesis?.getVoices() || []; } catch { voices = []; } }
if (typeof window !== 'undefined' && window.speechSynthesis) {
  refresh();
  window.speechSynthesis.onvoiceschanged = refresh;
}

export function ttsAvailable() { return typeof window !== 'undefined' && !!window.speechSynthesis; }

// Piper voice per language (2-letter code). License: the one of the recordings the voice was trained on.
// Add a language: pick a voice in https://huggingface.co/rhasspy/piper-voices, check its MODEL_CARD license.
export const PIPER_VOICES = {
  fr: { id: 'fr_FR-siwis-medium', name: 'Siwis', size: 63, license: 'CC BY 4.0' },
  tr: { id: 'tr_TR-dfki-medium', name: 'DFKI', size: 63, license: 'CC BY-NC-SA 4.0' },
};

let engine = 'natural'; // 'natural': Piper when the voice is installed; 'system': always the browser voice
const installed = {}; // 'fr' -> true when the Piper voice is on the device
export function setVoiceEngine(e) { engine = e || 'natural'; }
const piperOk = () => typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory;

// Voices already downloaded (at startup and after a download).
export async function refreshInstalled() {
  if (!piperOk()) return { ...installed };
  try {
    const { stored } = await import('@mintplex-labs/piper-tts-web');
    const ids = await stored();
    for (const [lang, v] of Object.entries(PIPER_VOICES)) installed[lang] = ids.includes(v.id);
  } catch { /* storage unavailable */ }
  return { ...installed };
}

// One inference session per voice (the model is loaded once).
const sessions = {};
function session(voiceId, progress) {
  if (!sessions[voiceId]) {
    sessions[voiceId] = (async () => {
      const { TtsSession } = await import('@mintplex-labs/piper-tts-web');
      TtsSession._instance = null; // the library keeps a single session: we want one per language
      return TtsSession.create({ voiceId, progress });
    })();
    sessions[voiceId].catch(() => { delete sessions[voiceId]; });
  }
  return sessions[voiceId];
}

// Download and prepare a language's voice. onProgress(0..1).
export async function installVoice(lang, onProgress) {
  const v = PIPER_VOICES[lang];
  if (!v) throw new Error('unknown voice');
  await session(v.id, (p) => { if (p.total && p.url?.endsWith('.onnx')) onProgress?.(p.loaded / p.total); });
  await refreshInstalled();
}

export async function removeVoice(lang) {
  const v = PIPER_VOICES[lang];
  const { remove } = await import('@mintplex-labs/piper-tts-web');
  await remove(v.id);
  delete sessions[v.id];
  await refreshInstalled();
}

let playId = 0; // each new reading cancels the previous one
let audio = null;

function pickVoice(lang) {
  if (!voices.length) refresh();
  const base = lang.slice(0, 2);
  const list = voices.filter((v) => v.lang?.toLowerCase().startsWith(base));
  const rank = (v) => (/natural/i.test(v.name) ? 0 : /online/i.test(v.name) ? 1 : /google/i.test(v.name) ? 2 : 3)
    + (v.lang?.toLowerCase() === lang.toLowerCase() ? 0 : 0.5);
  return list.sort((a, b) => rank(a) - rank(b))[0] || null;
}

function play(wav, rate, id) {
  return new Promise((resolve) => {
    if (id !== playId) { resolve(); return; }
    const url = URL.createObjectURL(wav);
    audio = new Audio(url);
    audio.playbackRate = rate;
    const done = () => { URL.revokeObjectURL(url); resolve(); };
    audio.onended = done;
    audio.onpause = done;
    audio.onerror = done;
    audio.play().catch(done);
  });
}

// Browser voice, waiting for the end (to chain pieces in order).
function speakSystemWait(text, lang, rate, id) {
  return new Promise((resolve) => {
    if (id !== playId || !ttsAvailable()) { resolve(); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.onend = resolve;
    u.onerror = resolve;
    window.speechSynthesis.speak(u);
  });
}

// ---- Text mixing French and the help language (Coco's answers) ----
// Coco puts French words between « »; the rest is assigned sentence by sentence (and parenthesis by
// parenthesis) to the language with more clues: letters, common small words, endings (MARKERS).
// Help languages written in another script (Arabic, Cyrillic…) are recognised by their script alone.
let helpLocale = 'tr-TR';
export function setHelpLocale(locale) { helpLocale = locale || 'tr-TR'; }
const FR_WORDS = new Set('le la les l un une des du de d au aux et ou est sont été être a ont avoir en dans sur sous avec pour par pas ne que qui quoi ce cette ces il elle ils elles on nous vous je tu son sa ses leur leurs mais donc car comme très plus tout tous être fait faire république français française france loi droit droits'.split(' '));
const MARKERS = {
  fr: { chars: /[éèêëàâîïôûùœæ]/g, words: FR_WORDS },
  tr: { chars: /[ğışİĞŞıöüÖÜ]/g, ends: /(lar|ları|leri|lık|lik|luk|lük|dır|dir|dur|dür|tır|tir|mek|mak|mez|maz|yor|sın|siniz|ndan|nden|mız|miz)$/, words: new Set('ve bir bu şu o için ile ama çok daha en gibi olarak olan değil var yok mı mi mu mü ne neden nasıl hangi her ya veya ki da de sen siz ben biz onlar kelime yani evet hayır fransa fransız türkçe'.split(' ')) },
};
function score(text, code) {
  const m = MARKERS[code];
  if (!m) return 0;
  const words = text.toLocaleLowerCase(code).split(/[^\p{L}']+/u).flatMap((w) => w.split("'")).filter(Boolean);
  return (text.match(m.chars) || []).length * 2 + words.filter((w) => m.words.has(w) || m.ends?.test(w)).length;
}
const wordCount = (text) => text.split(/[^\p{L}]+/u).filter(Boolean).length;
// Language of a piece: 'fr' or the help language code; on a tie, the text's main language (primary).
// A French sentence of 3+ words almost always has an accent or a common small word:
// with no French clue at all, it goes to the help language.
function detect(text, primary, help) {
  if (/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(text)) return help; // Arabic, Cyrillic…
  const f = score(text, 'fr');
  const h = score(text, help);
  if (f === h) return f === 0 && wordCount(text) >= 3 ? help : primary;
  return f > h ? 'fr' : help;
}
// Cut into pieces { text, lang }, ready to be read one after another.
// Boundaries: « », straight or curly quotes, parentheses, sentence ends, line breaks.
// Coco does not always follow its rules (Turkish between « », quotes "…"), so every piece is checked:
// - between « » or quotes: French on a tie;
// - elsewhere: the text's main language on a tie;
// - "word (translation)": an undecided word followed by a parenthesis takes the other language.
export function segments(text, primary = 'fr', help = helpLocale.slice(0, 2)) {
  const pieces = [];
  const collect = (t) => {
    const re = /«([^»]*)»|"([^"\n]*)"|“([^”\n]*)”|\(([^)\n]*)\)/g;
    let last = 0;
    const addPlain = (s) => {
      for (const sent of s.split(/(?<=[.!?…:;])\s+|\n+|\s[-–—]\s/)) pieces.push({ text: sent, kind: 'plain' });
    };
    for (const m of t.matchAll(re)) {
      addPlain(t.slice(last, m.index));
      if (m[4] !== undefined) {
        const inner = m[4].trim();
        const onlyQuote = /^(«[^»]*»|"[^"]*"|“[^”]*”)$/.test(inner); // e.g. ("deviz"): just a translation
        if (!onlyQuote && /[«"“]/.test(inner)) collect(inner); // a parenthesis that itself mixes quotes and text
        else pieces.push({ text: m[4], kind: 'paren' });
      } else for (const sent of (m[1] ?? m[2] ?? m[3]).split(/(?<=[.!?…])\s+|\n+/)) pieces.push({ text: sent, kind: 'quote' });
      last = m.index + m[0].length;
    }
    addPlain(t.slice(last));
  };
  collect(text);

  const out = [];
  for (const p of pieces) {
    p.text = p.text.replace(/[*#`_"“”«»]/g, '').replace(/\s+/g, ' ').trim().replace(/^['’:,;.\-\s]+/, '');
    if (!/\p{L}|\d/u.test(p.text)) continue;
    const f = score(p.text, 'fr');
    const h = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(p.text) ? 99 : score(p.text, help);
    p.tie = f === h && !(f === 0 && wordCount(p.text) >= 3);
    p.lang = p.tie ? (p.kind === 'quote' ? 'fr' : primary) : detect(p.text, primary, help);
    out.push(p);
  }
  for (let i = 0; i + 1 < out.length; i++) {
    const [a, b] = [out[i], out[i + 1]];
    if (!a.tie || b.kind !== 'paren') continue;
    if (b.tie) { a.lang = 'fr'; b.lang = help; } // Coco's vocabulary format: French word (translation)
    else a.lang = b.lang === 'fr' ? help : 'fr';
  }
  // short neighbouring pieces of the same language are merged (fewer cuts)
  const merged = [];
  for (const sg of out) {
    const last = merged.at(-1);
    if (last && last.lang === sg.lang && (last.text + ' ' + sg.text).length < 120) last.text += ' ' + sg.text;
    else merged.push({ ...sg });
  }
  return merged;
}

const localeOf = (code) => (code === 'fr' ? 'fr-FR' : helpLocale);

// Read the pieces in order, each with its voice. The next piece is prepared while the current one plays.
async function speakSegments(segs, rate, id) {
  const prepare = (sg) => {
    const v = PIPER_VOICES[sg.lang];
    if (engine !== 'natural' || !v || !installed[sg.lang]) return Promise.resolve(null);
    return session(v.id).then((ss) => ss.predict(sg.text)).catch(() => null);
  };
  let next = prepare(segs[0]);
  for (let i = 0; i < segs.length; i++) {
    const wav = await next;
    if (id !== playId) return;
    if (i + 1 < segs.length) next = prepare(segs[i + 1]);
    if (wav) await play(wav, rate, id);
    else await speakSystemWait(segs[i].text, localeOf(segs[i].lang), rate, id); // no natural voice: browser
  }
}

// lang: main language of the text (fr-FR, or the help language for Coco's answers).
export function speak(text, { lang = 'fr-FR', rate = 0.9 } = {}) {
  if (!text) return;
  stopSpeaking();
  const primary = lang.slice(0, 2).toLowerCase();
  const segs = segments(text, primary);
  if (segs.length) speakSegments(segs, rate, playId);
}

export function stopSpeaking() {
  playId++;
  try { audio?.pause(); } catch { /* ignore */ }
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}
