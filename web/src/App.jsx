import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StoreCtx, loadRoot, saveRoot, flush, storageKind, streakDays, MAX_CHATS, MAX_CHAT_MESSAGES } from './lib/store.js';
import { buildDaily, buildExam, buildMistakes, buildTheme, isWeak, qStat, Q_BY_ID, QUESTIONS } from './lib/quiz.js';
import { getStatus, getSystem, hasModel, recommendedModel, systemPrompt, warmUp, MODELS } from './lib/ai.js';
import { CocoAvatar, ModeFlag } from './components/common.jsx';
import { UI, MODES } from './data/i18n.js';
import Coco from './components/Coco.jsx';
import Home from './pages/Home.jsx';
import Practice from './pages/Practice.jsx';
import Session from './pages/Session.jsx';
import Result from './pages/Result.jsx';
import Mistakes from './pages/Mistakes.jsx';
import Progress from './pages/Progress.jsx';
import Vocab from './pages/Vocab.jsx';
import Settings from './pages/Settings.jsx';
import Setup from './pages/Setup.jsx';
import Profiles from './pages/Profiles.jsx';
import Tour from './components/Tour.jsx';
import { refreshInstalled, setHelpLocale, setVoiceEngine } from './lib/tts.js';
import { applyLang, defaultLang, helpInfo, helpLang } from './lang/langs.js';

const NAV = [
  { id: 'home', k: 'nav_home', ico: '🏠' },
  { id: 'practice', k: 'nav_practice', ico: '🎯' },
  { id: 'exam', k: 'nav_exam', ico: '📝' },
  { id: 'mistakes', k: 'nav_mistakes', ico: '🔁' },
  { id: 'progress', k: 'nav_progress', ico: '📈' },
  { id: 'vocab', k: 'nav_vocab', ico: '📚' },
  { id: 'settings', k: 'nav_settings', ico: '⚙️' },
];

export default function App() {
  const [root, setRootRaw] = useState(null);
  const [adding, setAdding] = useState(false); // creating a new profile
  const [, setLangTick] = useState(0); // re-render once the help language is applied
  const [route, setRoute] = useState({ name: 'home', params: {} });
  const [cocoCtx, setCocoCtx] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pendingAsk, setPendingAsk] = useState(null);
  const [ai, setAi] = useState({ status: { running: false, models: [] }, system: {} });
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  useEffect(() => { loadRoot().then(setRootRaw); }, []);
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener('beforeunload', onHide);
    return () => window.removeEventListener('beforeunload', onHide);
  }, []);

  const setRoot = useCallback((upd) => {
    setRootRaw((prev) => {
      const next = typeof upd === 'function' ? upd(prev) : upd;
      if (next !== prev) saveRoot(next);
      return next;
    });
  }, []);

  // state / setState: the active profile, as before profiles existed.
  const state = root?.active ? root.profiles[root.active] || null : null;
  const setState = useCallback((upd) => {
    setRoot((r) => {
      const cur = r.active && r.profiles[r.active];
      if (!cur) return r;
      const next = typeof upd === 'function' ? upd(cur) : upd;
      return next === cur ? r : { ...r, profiles: { ...r.profiles, [r.active]: next } };
    });
  }, [setRoot]);

  // Switching profile: back to home, Coco conversation reset.
  const openProfile = useCallback((id) => {
    setRoot((r) => ({ ...r, active: id }));
    setRoute({ name: 'home', params: {} });
    setCocoCtx(null);
    setAdding(false);
  }, [setRoot]);

  const refreshAi = useCallback(async () => {
    const [status, system] = await Promise.all([getStatus(), getSystem()]);
    setAi({ status, system });
  }, []);
  // Without AI: don't look for Ollama.
  const rootLoaded = !!root;
  const aiSetting = state?.settings.ai;
  useEffect(() => {
    if (!rootLoaded || aiSetting === 'off') return undefined; // after loading: we then know whether the launcher is there
    refreshAi();
    const t = setInterval(refreshAi, 20000);
    return () => clearInterval(t);
  }, [refreshAi, aiSetting, rootLoaded]);
  const aiOn = aiSetting === 'on' || (aiSetting == null && ai.status.running);

  // Coco conversation: the profile's current one, on load or profile switch.
  const activeId = root?.active;
  useEffect(() => {
    if (!state) { setMessages([]); return; }
    setMessages(state.chats.find((c) => c.id === state.chatId)?.messages || []);
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save the conversation when an answer is complete (not at every streamed word).
  useEffect(() => {
    if (!messages.length || messages.some((m) => m.pending)) return;
    const msgs = messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content })).slice(-MAX_CHAT_MESSAGES);
    if (!msgs.length) return;
    setState((s) => {
      const cur = s.chats.find((c) => c.id === s.chatId);
      if (cur && cur.messages.length === msgs.length && cur.messages.at(-1)?.content === msgs.at(-1).content) return s;
      const now = Date.now();
      const title = (msgs.find((m) => m.role === 'user')?.content || '…').replace(/\s+/g, ' ').slice(0, 70);
      const chat = cur ? { ...cur, updated: now, messages: msgs } : { id: 'c' + now.toString(36), title, start: now, updated: now, messages: msgs };
      const chats = [...s.chats.filter((c) => c.id !== chat.id), chat].slice(-MAX_CHATS);
      return { ...s, chats, chatId: chat.id };
    });
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Profile's reading voice; natural voices already downloaded.
  const voiceSetting = state?.settings.voice;
  useEffect(() => { setVoiceEngine(voiceSetting); }, [voiceSetting]);
  useEffect(() => { setHelpLocale(helpInfo().locale); });
  useEffect(() => { refreshInstalled(); }, []);

  // Heartbeat for the launcher (it stops when the window is closed).
  useEffect(() => {
    const ping = () => storageKind() === 'server' && fetch('/api/ping', { method: 'POST' }).catch(() => {});
    ping();
    const t = setInterval(ping, 15000);
    return () => clearInterval(t);
  }, []);

  const notify = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3500);
  }, []);

  const store = useMemo(() => ({ state, setState, root, setRoot, openProfile }), [state, setState, root, setRoot, openProfile]);

  // Model used by Coco: the chosen one if installed, otherwise the best available.
  const model = useMemo(() => {
    if (!state) return '';
    const st = ai.status;
    const chosen = state.settings.model;
    if (chosen && hasModel(st, chosen)) return chosen;
    const rec = recommendedModel(ai.system?.vram_mb);
    if (hasModel(st, rec)) return rec;
    const known = MODELS.find((m) => hasModel(st, m.name));
    if (known) return known.name;
    return st.models?.[0]?.name || '';
  }, [state, ai]);

  // Warm-up: load the model and its instructions at launch, so Coco's first answer is as fast
  // as the next ones. Also measures Coco's speed on this computer.
  const warmName = state?.profile.name;
  const warmMode = state?.settings.mode;
  useEffect(() => {
    if (!aiOn || !model || !ai.status.running) return;
    warmUp(model, systemPrompt({ name: warmName, mode: warmMode }))
      .then(({ tps }) => tps && setState((s) => ({ ...s, settings: { ...s.settings, aiSpeed: { model, tps: Math.round(tps * 10) / 10 } } })))
      .catch(() => {});
  }, [aiOn, model, ai.status.running, warmName, warmMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Profile's help language. Checked on every render: the profile creation screen may have changed it.
  // Before a profile is open (profile creation, profile choice): the language already applied, or the browser's.
  const wantLang = state?.settings.lang || helpLang() || defaultLang();
  useEffect(() => {
    if (!root || wantLang === helpLang()) return;
    const tick = () => setLangTick((n) => n + 1);
    applyLang(wantLang).then(tick).catch(() => applyLang(defaultLang()).then(tick));
  });

  // Theme: 'auto' follows the system. Kept in the browser for the first paint (see index.html).
  const themeSetting = state?.settings.theme;
  useEffect(() => {
    if (!themeSetting) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = themeSetting === 'auto' ? (mq.matches ? 'dark' : 'light') : themeSetting;
    };
    apply();
    try { localStorage.setItem('civictr-theme', themeSetting); } catch { /* ignore */ }
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [themeSetting]);

  if (!root) return <div className="setup"><CocoAvatar size={80} /></div>;
  const hasProfiles = Object.keys(root.profiles).length > 0;
  if (wantLang !== helpLang()) return <div className="setup"><CocoAvatar size={80} /></div>;
  if (!state) {
    return (
      <StoreCtx.Provider value={store}>
        {adding || !hasProfiles
          ? <Setup ai={ai} onCancel={hasProfiles ? () => setAdding(false) : null} />
          : <Profiles onAdd={() => setAdding(true)} />}
      </StoreCtx.Provider>
    );
  }

  const mode = state.settings.mode;
  const uiIdx = mode === 'tr' ? 1 : 0;
  const chatOpen = aiOn && state.settings.chatOpen;
  const setChatOpen = (v) => setState((s) => ({ ...s, settings: { ...s.settings, chatOpen: v } }));

  // Series in progress: kept in the saved state, so one can change page (or close the app) and resume it.
  const plan = state.current?.items?.every((it) => Q_BY_ID[it.id]) ? state.current : null;
  const resume = () => { setRoute({ name: 'session', params: {} }); document.querySelector('.content')?.scrollTo(0, 0); };

  const go = (name, params = {}) => {
    if (name === 'exam') { if (plan?.type === 'exam') resume(); else start('exam'); return; }
    setRoute({ name, params });
    if (name !== 'session') setCocoCtx(null);
    document.querySelector('.content')?.scrollTo(0, 0);
  };

  // force: replace the current series without asking (level change already confirmed).
  function start(type, opts = {}) {
    if (plan && !opts.force && !window.confirm(UI.replace_current[uiIdx])) return;
    let items;
    if (type === 'daily') items = buildDaily(state, 15);
    else if (type === 'exam') {
      opts = { ...opts, level: opts.level || state.settings.examLevel || 'real' };
      items = buildExam(state, opts.level);
    }
    else if (type === 'mistakes') items = buildMistakes(state, 15);
    else items = buildTheme(state, opts.theme, opts.sub, 10);
    if (!items.length) return;
    const { force, ...rest } = opts;
    const current = { type, items, ...rest, key: Date.now(), startedAt: Date.now(), idx: 0, answers: {} };
    setState((s) => ({ ...s, current, settings: type === 'exam' ? { ...s.settings, examLevel: rest.level } : s.settings }));
    setRoute({ name: 'session', params: {} });
    document.querySelector('.content')?.scrollTo(0, 0);
  }

  const askCoco = aiOn ? (kind) => { setChatOpen(true); setPendingAsk('qp_' + kind); } : null;
  const askAbout = !aiOn ? null : (ctx) => { setCocoCtx(ctx); setChatOpen(true); setPendingAsk(ctx.chosen != null && ctx.chosen !== 0 ? 'qp_why' : 'qp_explain'); };

  const weakCount = QUESTIONS.filter((q) => isWeak(qStat(state, q.id))).length;
  const streak = streakDays(state.days);
  const navName = route.name === 'session' ? (plan?.type === 'exam' ? 'exam' : 'practice') : route.name === 'result' ? 'progress' : route.name;

  let page;
  switch (route.name) {
    case 'practice': page = <Practice start={start} focusTheme={route.params.theme} />; break;
    case 'session': page = plan && <Session key={plan.key} plan={plan} go={go} restart={(o) => start(plan.type, { ...o, force: true })} setCoco={setCocoCtx} askCoco={askCoco} notify={notify} />; break;
    case 'result': page = <Result sessionId={route.params.sessionId} freshBadges={route.params.freshBadges} go={go} askAbout={askAbout}
      startAgain={() => { const s = state.sessions.find((x) => x.id === route.params.sessionId); start(s?.type || 'daily', { theme: s?.theme, sub: s?.sub, level: s?.level }); }} />; break;
    case 'mistakes': page = <Mistakes start={start} askAbout={askAbout} />; break;
    case 'progress': page = <Progress go={go} />; break;
    case 'vocab': page = <Vocab />; break;
    case 'settings': page = <Settings ai={ai} aiOn={aiOn} refreshAi={refreshAi} notify={notify} />; break;
    default: page = <Home start={start} go={go} />;
  }

  return (
    <StoreCtx.Provider value={store}>
      <div className={`app ${chatOpen ? 'chat-open' : ''}`} lang={uiIdx ? helpLang() : 'fr'} dir={uiIdx && helpInfo().dir === 'rtl' ? 'rtl' : 'ltr'}>
        <nav className="side" aria-label="Menu">
          <div className="brand">
            <CocoAvatar size={40} />
            <div className="brand-name">{UI.appName[uiIdx]}<small>{UI.app_sub[uiIdx]}</small></div>
          </div>
          {NAV.map((n) => (
            <button key={n.id} type="button" className="nav-btn" aria-current={navName === n.id ? 'page' : undefined} onClick={() => go(n.id)}>
              <span className="ico">{n.ico}</span>
              <span>{UI[n.k][uiIdx]}{mode === 'bi' && <span className="sub">{UI[n.k][1]}</span>}</span>
              {n.id === 'mistakes' && weakCount > 0 && <span className="badge">{weakCount}</span>}
            </button>
          ))}
          <div className="side-thanks">
            <b>{UI.side_luck[uiIdx]}</b>
            <span>{UI.side_by[uiIdx]}</span>
            <a href="https://ko-fi.com/minihollow" target="_blank" rel="noreferrer">☕ {UI.side_tip[uiIdx]}</a>
          </div>
          {aiOn && <div className="side-foot">{ai.status.running && model ? <>🟢 Coco · {model}</> : <>🔴 Coco</>}</div>}
        </nav>

        <div className="main">
          <header className="topbar">
            <ModeSwitch mode={mode} setMode={(m) => setState((s) => ({ ...s, settings: { ...s.settings, mode: m } }))} uiIdx={uiIdx} />
            <div className="spacer" />
            <span className="pill sun" title={UI.streak_days[uiIdx]}>🔥 {streak}</span>
            <span className="pill" title={UI.xp[uiIdx]}>⭐ {state.xp}</span>
            {aiOn && !chatOpen && (
              <button type="button" className="btn small ink" onClick={() => setChatOpen(true)}>🐓 Coco</button>
            )}
          </header>
          <main className="content">
            {plan && route.name !== 'session' && (
              <button type="button" className="resume-bar" onClick={resume}>
                <span>▶ <b>{UI.resume[uiIdx]}</b> · {UI[{ daily: 'type_daily', theme: 'type_theme', exam: 'type_exam', mistakes: 'type_mistakes' }[plan.type]][uiIdx]}
                  {plan.level && <> · {UI['lvl_' + plan.level][uiIdx]}</>}</span>
                <span className="muted small">{Object.keys(plan.answers || {}).length} / {plan.items.length}</span>
              </button>
            )}
            {page}
          </main>
        </div>

        {chatOpen && (
          <Coco ctx={cocoCtx} ai={ai} model={model} messages={messages} setMessages={setMessages}
            pendingAsk={pendingAsk} clearAsk={() => setPendingAsk(null)} onClose={() => setChatOpen(false)} go={go} />
        )}
        {toast && <div className="toast" role="status">{toast}</div>}
        {!state.profile.tourDone && <Tour aiOn={aiOn} />}
      </div>
    </StoreCtx.Provider>
  );
}

function ModeSwitch({ mode, setMode, uiIdx }) {
  return (
    <div className="modes" role="group" aria-label={UI.mode_label[uiIdx]}>
      {MODES.map((m) => (
        <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} title={UI['mode_' + m + '_desc'][uiIdx]}>
          <ModeFlag mode={m} />{UI['mode_' + m][uiIdx]}
        </button>
      ))}
    </div>
  );
}
