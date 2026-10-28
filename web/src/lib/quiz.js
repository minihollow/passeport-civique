import QUESTIONS from '../data/questions.json';
import { THEMES, EXAM } from '../data/themes.js';
import { todayKey, streakDays } from './store.js';

export { QUESTIONS };
export const Q_BY_ID = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

const DAY = 86400000;
const INTERVALS = [0, 1, 2, 4, 8, 16]; // days, per box (Leitner)
export const MASTERED_BOX = 3;

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Right answers: index 0 and the variants listed in q.good (see build-content.mjs).
export const isRight = (q, oi) => oi === 0 || !!q?.good?.includes(oi);
export const rightIn = (q, order) => order.find((oi) => isRight(q, oi)) ?? 0;

// The 4 displayed choices: indexes into q.o, with exactly one right answer.
// - new question, or missed last time: the 4 base choices, to learn;
// - already answered right: new wrong answers, and half the time another wording of the right one;
// - mastered: fully random draw.
// Mock exam (level): 'real' = original choices like on exam day, 'mid' = like an already-answered question,
// 'hard' = another wording of the right answer and new wrong answers first.
export const EXAM_LEVELS = ['real', 'mid', 'hard'];
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];
export function makeOrder(q, st, level) {
  const base = [0, 1, 2, 3];
  if (!q || q.o.length <= 4 || level === 'real' || (!level && !(st?.run > 0))) return shuffle(base);
  const good = q.good || [];
  const wrong = q.o.map((_, i) => i).filter((i) => !isRight(q, i));
  if (level === 'hard') {
    const r = good.length ? pickOne(good) : 0;
    const harder = [...shuffle(wrong.filter((i) => i > 3)), ...shuffle(wrong.filter((i) => i <= 3))];
    return shuffle([r, ...harder.slice(0, 3)]);
  }
  const free = !level && isMastered(st);
  const r = !free && Math.random() < 0.5 ? 0 : pickOne([0, ...good]);
  return shuffle([r, ...shuffle(wrong).slice(0, 3)]);
}

export function qStat(state, id) { return state.q[id] || { box: 0, seen: 0, ok: 0, ko: 0, last: 0, due: 0, run: 0 }; }
export const isMastered = (st) => st.box >= MASTERED_BOX;
export const isWeak = (st) => st.ko > 0 && st.run < 2;

function pool(filter) { return QUESTIONS.filter(filter); }

const item = (state, level) => (q) => ({ id: q.id, order: makeOrder(q, qStat(state, q.id), level) });

// Daily series: questions due first, then new ones, then review.
export function buildDaily(state, n = 15) {
  const now = Date.now();
  const all = QUESTIONS;
  const due = shuffle(all.filter((q) => { const s = state.q[q.id]; return s && s.seen > 0 && s.due <= now && !isMastered(s); }))
    .sort((a, b) => qStat(state, a.id).box - qStat(state, b.id).box);
  const fresh = shuffle(all.filter((q) => !state.q[q.id]?.seen));
  const rest = shuffle(all.filter((q) => state.q[q.id]?.seen && !due.includes(q)))
    .sort((a, b) => qStat(state, a.id).due - qStat(state, b.id).due);
  const picked = [];
  const take = (list, max) => { for (const q of list) { if (picked.length >= max) break; if (!picked.includes(q)) picked.push(q); } };
  take(due, Math.ceil(n * 0.5));
  take(balancedByTheme(fresh), n);
  take(rest, n);
  return shuffle(picked).map(item(state));
}

function balancedByTheme(list) {
  // Alternate themes for a varied series.
  const groups = THEMES.map((t) => list.filter((q) => q.t === t.id));
  const out = [];
  let added = true;
  while (added) {
    added = false;
    for (const g of groups) if (g.length) { out.push(g.shift()); added = true; }
  }
  return out;
}

export function buildTheme(state, themeId, subId, n = 10) {
  const list = pool((q) => q.t === themeId && (!subId || q.s === subId));
  // Least seen or missed questions first.
  const scored = shuffle(list).sort((a, b) => score(state, a.id) - score(state, b.id));
  return shuffle(scored.slice(0, Math.min(n, scored.length))).map(item(state));
}

function score(state, id) {
  const s = qStat(state, id);
  return s.box * 10 + s.seen - s.ko * 3;
}

export function buildMistakes(state, n = 15) {
  const list = QUESTIONS.filter((q) => isWeak(qStat(state, q.id)))
    .sort((a, b) => qStat(state, b.id).ko - qStat(state, a.id).ko);
  return shuffle(list.slice(0, n)).map(item(state));
}

// Mock exam: official split per sub-theme, in theme order.
export function buildExam(state, level = 'real') {
  const out = [];
  for (const t of THEMES) {
    for (const s of t.subs) {
      const list = pool((q) => q.t === t.id && q.s === s.id);
      const sorted = shuffle(list).sort((a, b) => qStat(state, a.id).seen - qStat(state, b.id).seen);
      out.push(...sorted.slice(0, s.n));
    }
  }
  if (out.length !== EXAM.total) console.warn('incomplete exam', out.length);
  return out.map(item(state, level));
}

// Record an answer: Leitner box, today's stats, points.
export function applyAnswer(state, id, ok) {
  const now = Date.now();
  const s = { ...qStat(state, id) };
  s.seen += 1;
  s.last = now;
  if (ok) {
    s.ok += 1; s.run += 1;
    s.box = Math.min(5, s.box + 1);
    s.due = now + INTERVALS[s.box] * DAY;
  } else {
    s.ko += 1; s.run = 0;
    s.box = 1;
    s.due = now; // a mistake comes back in the next series
  }
  const key = todayKey();
  const day = { answered: 0, correct: 0, xp: 0, ...(state.days[key] || {}) };
  const gain = ok ? 10 : 2;
  day.answered += 1; if (ok) day.correct += 1; day.xp += gain;
  return { ...state, q: { ...state.q, [id]: s }, days: { ...state.days, [key]: day }, xp: state.xp + gain };
}

// Overall stats
export function masteryOf(state, filter = () => true) {
  const list = QUESTIONS.filter(filter);
  const m = list.filter((q) => isMastered(qStat(state, q.id))).length;
  const seen = list.filter((q) => qStat(state, q.id).seen > 0).length;
  return { total: list.length, mastered: m, seen, pct: list.length ? m / list.length : 0 };
}

export function readiness(state) {
  // 60% question mastery, 40% average of the last 3 mock exams in French.
  const m = masteryOf(state).pct;
  const exams = state.sessions.filter((s) => s.type === 'exam' && s.end).slice(-3);
  const frExams = exams.filter((s) => s.mode === 'fr');
  const ex = frExams.length ? frExams.reduce((a, s) => a + s.correct / s.total, 0) / frExams.length
    : exams.length ? 0.6 * exams.reduce((a, s) => a + s.correct / s.total, 0) / exams.length : 0;
  return Math.round(100 * (0.6 * m + 0.4 * ex));
}

// Stamps (badges)
const totalAnswered = (st) => Object.values(st.days).reduce((a, d) => a + d.answered, 0);
const THEME_SHORT = { pv: ['VALEURS', 'DEĞERLER'], sip: ['INSTITUTIONS', 'KURUMLAR'], dd: ['DROITS', 'HAKLAR'], hgc: ['HISTOIRE', 'TARİH'], vsf: ['VIE EN FRANCE', 'FRANSA HAYATI'] };
// name: full title; short: stamp text; icon: stamp centre; color: ink
export const BADGES = [
  { id: 'first', name: ['Première série terminée', 'İlk seri tamamlandı'], short: ['1RE SÉRIE', 'İLK SERİ'], icon: '✏️', color: 'var(--stamp)', test: (st) => st.sessions.some((s) => s.end) },
  { id: 'streak3', name: ['3 jours de suite', '3 gün üst üste'], short: ['3 JOURS', '3 GÜN'], icon: '🔥', color: 'var(--orange)', test: (st) => streakDays(st.days) >= 3 },
  { id: 'perfect', name: ['Une série sans faute', 'Hatasız bir seri'], short: ['SANS FAUTE', 'HATASIZ'], icon: '🎯', color: 'var(--tr)', test: (st) => st.sessions.some((s) => s.end && s.total >= 10 && s.correct === s.total) },
  { id: 'q100', name: ['100 réponses données', '100 cevap verildi'], short: ['100 RÉPONSES', '100 CEVAP'], icon: '💯', color: 'var(--stamp-ink)', test: (st) => totalAnswered(st) >= 100 },
  { id: 'exam_pass', name: ['Premier examen blanc réussi', 'İlk deneme sınavı geçildi'], short: ['EXAMEN', 'SINAV'], icon: '✅', color: 'var(--ok)', test: (st) => st.sessions.some((s) => s.type === 'exam' && s.passed) },
  { id: 'streak7', name: ['7 jours de suite', '7 gün üst üste'], short: ['7 JOURS', '7 GÜN'], icon: '🔥', color: 'var(--orange)', test: (st) => streakDays(st.days) >= 7 },
  ...THEMES.map((t) => ({ id: 'theme_' + t.id, name: [`${t.name[0]} : 80 % maîtrisé`, `${t.name[1]}: %80 öğrenildi`], short: THEME_SHORT[t.id], icon: t.icon, color: 'var(--stamp)', theme: t.id, test: (st) => masteryOf(st, (q) => q.t === t.id).pct >= 0.8 })),
  { id: 'half', name: ['La moitié des questions maîtrisée', 'Soruların yarısı öğrenildi'], short: ['MOITIÉ', 'YARISI'], icon: '🌓', color: 'var(--stamp-ink)', test: (st) => masteryOf(st).pct >= 0.5 },
  { id: 'q500', name: ['500 réponses données', '500 cevap verildi'], short: ['500 RÉPONSES', '500 CEVAP'], icon: '🏅', color: 'var(--stamp-ink)', test: (st) => totalAnswered(st) >= 500 },
  { id: 'exam_fr', name: ['Examen blanc réussi en français', 'Deneme sınavı Fransızca geçildi'], short: ['EN FRANÇAIS', 'FRANSIZCA'], icon: '🗼', color: 'var(--ko)', test: (st) => st.sessions.some((s) => s.type === 'exam' && s.passed && s.mode === 'fr') },
  { id: 'all', name: ['Toutes les questions maîtrisées', 'Bütün sorular öğrenildi'], short: ['PRÊTE !', 'HAZIR!'], icon: '🎓', color: 'var(--ok)', test: (st) => masteryOf(st).pct >= 0.95 },
];

export function awardBadges(state) {
  const now = Date.now();
  let badges = state.badges;
  const fresh = [];
  for (const b of BADGES) {
    if (!badges[b.id] && b.test(state)) { badges = { ...badges, [b.id]: now }; fresh.push(b); }
  }
  return { state: fresh.length ? { ...state, badges } : state, fresh };
}

export function formatDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m} min ${String(r).padStart(2, '0')}` : `${r} s`;
}
