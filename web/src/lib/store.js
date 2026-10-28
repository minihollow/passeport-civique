// App state + saving.
// With the Windows launcher: saved to a file through /api/state.
// Without it (web version): saved in the browser.
// Saved shape: { kind, version: 2, active, profiles: { id: one profile's state } }.
import { createContext, useContext } from 'react';

export const STATE_VERSION = 1;

export function initialState() {
  return {
    version: STATE_VERSION,
    profile: { name: '', createdAt: Date.now(), setupDone: false, tourDone: true },
    // ai: 'on' / 'off', or unset = Coco on only if Ollama is found.
    settings: { lang: 'tr', mode: 'tr', ai: null, model: '', examDate: '', dailyGoal: 20, ttsRate: 0.9, voice: 'natural', chatOpen: true, showAllTr: false, theme: 'auto', examLevel: 'real' },
    q: {}, // per question: { box, seen, ok, ko, last, due, run }
    sessions: [],
    days: {}, // 'YYYY-MM-DD': { answered, correct, xp }
    xp: 0,
    badges: {},
    // Conversations with Coco: { id, title, start, updated, messages: [{ role, content }] }, most recent last.
    chats: [],
    chatId: null, // current conversation (null: new conversation)
  };
}

export const MAX_CHATS = 50;
export const MAX_CHAT_MESSAGES = 200;

const LS_KEY = 'civictr-state';
let backend = null; // 'server' | 'local'

export const ROOT_KIND = 'passeport-civique';
export function emptyRoot() { return { kind: ROOT_KIND, version: 2, active: null, profiles: {} }; }

export async function loadRoot() {
  try {
    const r = await fetch('/api/state', { cache: 'no-store' });
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) {
      backend = 'server';
      const txt = await r.text();
      return toRoot(txt.trim() ? JSON.parse(txt) : null);
    }
  } catch { /* no server */ }
  backend = 'local';
  // Ask the browser not to evict progress when the device runs out of space.
  try { navigator.storage?.persist?.(); } catch { /* ignore */ }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return toRoot(JSON.parse(raw));
  } catch { /* storage unavailable */ }
  return emptyRoot();
}

// Accepts the old format (single profile, version 1) and the new one.
// With several profiles, active = null: the app asks 'Who is studying?' at launch.
export function toRoot(data) {
  const root = emptyRoot();
  if (!data || typeof data !== 'object') return root;
  if (data.profiles && typeof data.profiles === 'object') {
    for (const [id, s] of Object.entries(data.profiles)) root.profiles[id] = migrate(s);
  } else if (data.profile?.setupDone) {
    root.profiles[newProfileId()] = migrate(data);
  }
  const ids = Object.keys(root.profiles);
  root.active = ids.length === 1 ? ids[0] : null;
  return root;
}

export const newProfileId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function newProfile(name, mode, lang = 'tr') {
  const s = initialState();
  return { ...s, profile: { ...s.profile, name, setupDone: true, tourDone: false }, settings: { ...s.settings, mode, lang } };
}

export function migrate(s) {
  const base = initialState();
  if (!s || typeof s !== 'object') return base;
  return {
    ...base,
    ...s,
    profile: { ...base.profile, ...(s.profile || {}) },
    settings: { ...base.settings, ...(s.settings || {}) },
    q: s.q || {},
    sessions: Array.isArray(s.sessions) ? s.sessions : [],
    days: s.days || {},
    badges: s.badges || {},
    xp: s.xp || 0,
    chats: Array.isArray(s.chats) ? s.chats : [],
    chatId: s.chatId || null,
  };
}

let saveTimer = null;
let pending = null;
export function saveRoot(root) {
  pending = root;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 400);
}

export async function flush() {
  if (!pending) return;
  const body = JSON.stringify(pending);
  pending = null;
  if (backend === 'server') {
    try {
      await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body, keepalive: body.length < 60000 });
      return;
    } catch { /* fall back to the browser */ }
  }
  try { localStorage.setItem(LS_KEY, body); } catch { /* ignore */ }
}

export function storageKind() { return backend; }

export const StoreCtx = createContext(null);
export function useStore() { return useContext(StoreCtx); }

export function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function streakDays(days) {
  // Consecutive days with at least one answer, counting from today or yesterday.
  let n = 0;
  const d = new Date();
  if (!days[todayKey(d)]?.answered) d.setDate(d.getDate() - 1);
  while (days[todayKey(d)]?.answered) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
