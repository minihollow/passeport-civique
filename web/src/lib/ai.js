// Ollama client (local AI): through the Windows launcher (/ollama), or directly in the web version.
import { Q_BY_ID, isRight, rightIn } from './quiz.js';
import { THEME_BY_ID, subName } from '../data/themes.js';
import { helpInfo } from '../lang/langs.js';
import { storageKind } from './store.js';

// With the Windows launcher (or in development): Ollama proxied through /ollama.
// Web version: Ollama called directly; it must allow this site (OLLAMA_ORIGINS, see Settings).
export const OLLAMA_DIRECT = 'http://localhost:11434';
export const viaProxy = () => storageKind() === 'server' || import.meta.env.DEV;
const base = () => (viaProxy() ? '/ollama' : OLLAMA_DIRECT);

// From biggest to smallest. minVram: advised video memory (GB).
const MODELS_FR = [
  { name: 'gemma4:26b', size: '≈ 19 Go', minVram: 20,
    desc: 'Le plus précis. Idéal avec 24 Go de mémoire vidéo (RTX 4090). Fonctionne aussi avec 16 Go, plus lentement.' },
  { name: 'gemma3:12b', size: '≈ 8 Go', minVram: 10,
    desc: 'Rapide et bon dans beaucoup de langues. Idéal avec 16 Go de mémoire vidéo (RTX 5080).' },
  { name: 'gemma4:e4b', size: '≈ 7 Go', minVram: 6,
    desc: 'Rapide, réponses plus simples. Pour une carte graphique de 6 à 8 Go.' },
  { name: 'gemma3:4b', size: '≈ 3,4 Go', minVram: 0,
    desc: "Le plus léger. Pour un ordinateur sans carte graphique (8 Go de mémoire minimum). Plus lent et moins précis : essayez-le, sinon gardez l'app sans IA." },
];
// Descriptions become [French, help language] pairs (2nd slot filled from the help language pack).
export const MODELS = MODELS_FR.map((m) => ({ ...m, desc: [m.desc, m.desc] }));

// Advised model from the video memory (Windows launcher: nvidia-smi).
// Without it (web version, non-NVIDIA card): use the graphics card reported by the browser.
export function recommendedModel(vramMB, gpu = gpuInfo()) {
  if (vramMB) {
    if (vramMB >= 20000) return 'gemma4:26b';
    if (vramMB >= 10000) return 'gemma3:12b';
    if (vramMB >= 6000) return 'gemma4:e4b';
    return 'gemma3:4b';
  }
  const guess = vramGuess(gpu.name);
  if (guess) return recommendedModel(guess, gpu);
  return gpu.dedicated ? 'gemma4:e4b' : 'gemma3:4b';
}

// Likely video memory (MB) from the card name, for the most common cards.
function vramGuess(name) {
  if (/rtx\s*(3090|4090|5090)|radeon rx 7900 xtx/i.test(name)) return 24000;
  if (/rtx\s*(3080|4080|5080|4070 ti super|5070 ti|4060 ti 16)|radeon rx (6800|6900|7800|7900|9070)/i.test(name)) return 16000;
  if (/rtx\s*(3060|4060|4070|5060|5070|2080|2070)|radeon rx (6600|6700|7600|7700)/i.test(name)) return 8000;
  return null;
}

// Graphics card reported by the browser (WebGL). dedicated: discrete card or Apple chip.
let gpuCache = null;
export function gpuInfo() {
  if (gpuCache) return gpuCache;
  let name = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
  } catch { /* no WebGL */ }
  const dedicated = /nvidia|geforce|rtx|radeon rx|radeon pro|arc a\d|apple m\d/i.test(name);
  // « ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Ti (0x…) Direct3D11 …) » -> « NVIDIA GeForce RTX 3080 Ti »
  const parts = name.replace(/^ANGLE \((.*)\)$/, '$1').split(', ');
  const short = (parts.find((s) => /geforce|radeon|quadro|rtx|arc|iris|uhd|apple/i.test(s)) || parts[0] || '')
    .replace(/\s*\(0x[0-9a-f]+\).*$/i, '').replace(/\s+Direct3D.*$/i, '').trim();
  gpuCache = { name: short, dedicated, ram: navigator.deviceMemory || null };
  return gpuCache;
}

// Coco's speed (roughly words per second): fast, ok, slow.
export const speedLevel = (tps) => (tps == null ? null : tps >= 15 ? 'fast' : tps >= 6 ? 'ok' : 'slow');
const tpsOf = (ev) => (ev?.eval_count && ev.eval_duration ? ev.eval_count / (ev.eval_duration / 1e9) : null);

// Loads the model and prepares the start of the conversation (Coco's instructions),
// so the first real question is not slow. Returns the measured speed.
export async function warmUp(model, system) {
  const r = await fetch(`${base()}/api/chat`, {
    method: 'POST',
    body: JSON.stringify({
      model, stream: false, keep_alive: '30m', think: false,
      messages: [{ role: 'system', content: system }, { role: 'user', content: 'Bonjour' }],
      options: { temperature: 0.4, num_ctx: 8192, num_predict: 24 },
    }),
  });
  if (!r.ok) throw new Error(await r.text());
  const ev = await r.json();
  return { tps: tpsOf(ev), loadMs: Math.round((ev.load_duration || 0) / 1e6) };
}

export async function getSystem() {
  if (storageKind() !== 'server') return {};
  try { const r = await fetch('/api/system'); if (r.ok) return await r.json(); } catch { /* ignore */ }
  return {};
}

export async function getStatus() {
  try {
    const v = await fetch(`${base()}/api/version`);
    if (!v.ok) return { running: false, models: [] };
    const t = await fetch(`${base()}/api/tags`);
    const tags = t.ok ? await t.json() : { models: [] };
    return { running: true, version: (await v.json()).version, models: (tags.models || []).map((m) => ({ name: m.name, size: m.size })) };
  } catch {
    return { running: false, models: [] };
  }
}

export function hasModel(status, name) {
  if (!name) return false;
  const want = name.includes(':') ? name : name + ':latest';
  return status.models?.some((m) => m.name === want || m.name === name);
}

async function* ndjson(resp) {
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) yield JSON.parse(line);
    }
  }
  if (buf.trim()) yield JSON.parse(buf);
}

export async function pullModel(name, onProgress, signal) {
  const r = await fetch(`${base()}/api/pull`, { method: 'POST', body: JSON.stringify({ model: name, stream: true }), signal });
  if (!r.ok) throw new Error(await r.text());
  for await (const ev of ndjson(r)) {
    if (ev.error) throw new Error(ev.error);
    onProgress?.(ev);
  }
}

export async function chatStream({ model, messages, onToken, onSpeed, signal }) {
  const body = (think) => JSON.stringify({
    model, messages, stream: true, keep_alive: '30m',
    ...(think === false ? { think: false } : {}),
    options: { temperature: 0.4, num_ctx: 8192 },
  });
  let r = await fetch(`${base()}/api/chat`, { method: 'POST', body: body(false), signal });
  if (!r.ok) {
    const err = await r.text();
    // Some models reject the 'think' parameter: retry without it.
    if (/think/i.test(err)) r = await fetch(`${base()}/api/chat`, { method: 'POST', body: body(undefined), signal });
    else throw new Error(err);
    if (!r.ok) throw new Error(await r.text());
  }
  let full = '';
  for await (const ev of ndjson(r)) {
    if (ev.error) throw new Error(ev.error);
    const piece = ev.message?.content || '';
    if (piece) { full += piece; onToken?.(full); }
    if (ev.done) { onSpeed?.(tpsOf(ev)); break; }
  }
  return full;
}

// L: name of the help language in French ('turc', 'anglais'…), as the prompt is in French.
const LANG_RULE = {
  tr: (L) => `Réponds en ${L}. Quand tu cites un mot ou une phrase en français, mets-le entre guillemets « » et donne sa traduction en ${L}.`,
  bi: (L) => `Réponds en ${L}, mais écris les mots et expressions clés en français (entre « ») avec leur traduction en ${L}, pour l'aider à apprendre le français petit à petit.`,
  fr: (L) => `Réponds en français très simple (niveau A2) avec des phrases courtes. Mets la traduction en ${L} des mots difficiles entre parenthèses. Si la personne t'écrit en ${L}, réponds quand même en français simple, puis ajoute un court résumé en ${L}.`,
};

export function systemPrompt({ name, mode }) {
  const L = helpInfo().nameFr;
  return [
    `Tu es Coco, un coq sympathique et patient : le tuteur personnel de ${name || 'cette personne'}.`,
    `Sa langue maternelle est le ${L}. Elle vit en France et débute en français (niveau A1).`,
    "Elle prépare l'examen civique français pour la carte de séjour pluriannuelle : QCM de 40 questions en français, 45 minutes, il faut 32 bonnes réponses. Thèmes : principes et valeurs de la République, système institutionnel et politique, droits et devoirs, histoire-géographie-culture, vivre dans la société française. Il y a 28 questions de connaissance et 12 mises en situation.",
    "Ton rôle : expliquer simplement les questions, le vocabulaire français, l'histoire de France, les institutions et les valeurs de la République, avec des exemples de la vie quotidienne en France.",
    `Langue : ${(LANG_RULE[mode] || LANG_RULE.tr)(L)}`,
    "Règles :",
    "- Réponses courtes et claires (3 à 8 phrases ou une petite liste), ton chaleureux et encourageant.",
    "- Pour expliquer un mot français : le mot, sa traduction turque, puis un exemple simple en français avec sa traduction.",
    "- Sois exact. La réponse officielle fournie dans le contexte est la bonne : ne la contredis jamais. Si tu n'es pas sûr d'un fait, dis-le.",
    "- Si la personne n'a pas encore répondu à la question affichée, donne des indices sans révéler la bonne réponse, sauf si elle la demande clairement.",
    "- Pour sa situation administrative personnelle (titre de séjour, préfecture, dates), conseille de vérifier sur service-public.fr ou auprès de la préfecture.",
    "- N'utilise pas de tableaux. Tu peux utiliser **gras** et des listes à puces.",
    // Read aloud with two voices: « » tells which parts are French (see lib/tts.js).
    `- Mets tout ce qui est en français entre « », et rien d'autre : jamais de ${L} entre « ». N'utilise pas de guillemets droits (").`,
    `- N'écris que dans ces deux langues, le français et le ${L} : jamais d'anglais, même pour une traduction entre parenthèses.`,
  ].join('\n');
}

const L = ['A', 'B', 'C', 'D'];
export function questionContext(ctx) {
  if (!ctx) return '';
  const q = Q_BY_ID[ctx.id];
  if (!q) return '';
  const theme = THEME_BY_ID[q.t];
  const sub = subName(q.t, q.s);
  const lines = [
    `Question affichée à l'écran (thème : ${theme?.name[0]} › ${sub[0]}) :`,
    `FR : ${q.q[0]}`,
    `${helpInfo().nameFr} : ${q.q[1]}`,
    'Choix proposés :',
    ...ctx.order.map((oi, k) => `${L[k]}) ${q.o[oi][0]}  (${helpInfo().nameFr} : ${q.o[oi][1]})`),
    `Bonne réponse : ${L[ctx.order.indexOf(rightIn(q, ctx.order))]}) ${q.o[rightIn(q, ctx.order)][0]}`,
    `Explication : ${q.x[0]}`,
  ];
  if (ctx.chosen == null) lines.push("Statut : elle n'a pas encore répondu.");
  else lines.push(`Statut : elle a répondu ${L[ctx.order.indexOf(ctx.chosen)]}) ${q.o[ctx.chosen][0]} — ${isRight(q, ctx.chosen) ? 'correct' : 'incorrect'}.`);
  return lines.join('\n');
}
