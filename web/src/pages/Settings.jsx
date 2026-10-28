import { useEffect, useRef, useState } from 'react';
import { U, useLang, ModeFlag } from '../components/common.jsx';
import { useStore, initialState, migrate, storageKind } from '../lib/store.js';
import { MODELS, viaProxy, gpuInfo, hasModel, pullModel, recommendedModel, speedLevel, systemPrompt, warmUp } from '../lib/ai.js';
import { PIPER_VOICES, installVoice, refreshInstalled, removeVoice, speak } from '../lib/tts.js';
import { LANGS, helpInfo } from '../lang/langs.js';
import { UI } from '../data/i18n.js';

export default function Settings({ ai, aiOn, refreshAi, notify }) {
  const { state, setState, setRoot } = useStore();
  const { ui, uiIdx } = useLang();
  const set = (patch) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  const fileRef = useRef(null);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `passeport-civique-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const importData = async (file) => {
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || !('sessions' in data) || !('q' in data)) throw new Error('bad');
      setState(migrate(data));
      notify(ui('import_done'));
    } catch { notify(ui('import_bad')); }
  };

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <h1><U k="settings_title" dual /></h1>

      <section className="panel settings-grid">
        <div className="field">
          <label htmlFor="name">{ui('set_name')}</label>
          <input id="name" className="input" value={state.profile.name} maxLength={40}
            onChange={(e) => setState((s) => ({ ...s, profile: { ...s.profile, name: e.target.value } }))} />
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn small" onClick={() => setRoot((r) => ({ ...r, active: null }))}>👥 {ui('profile_switch')}</button>
          <button type="button" className="btn small" onClick={() => setState((s) => ({ ...s, profile: { ...s.profile, tourDone: false } }))}>🧭 {ui('tour_again')}</button>
          <button type="button" className="btn small danger" onClick={() => {
            if (!window.confirm(ui('profile_delete_confirm').replace('{n}', state.profile.name))) return;
            setRoot((r) => {
              const profiles = { ...r.profiles };
              delete profiles[r.active];
              return { ...r, profiles, active: null };
            });
          }}>🗑 {ui('profile_delete')}</button>
        </div>
        {Object.keys(LANGS).length > 1 && (
          <div className="field">
            <label htmlFor="lang">{ui('set_lang')}</label>
            <select id="lang" className="input" value={state.settings.lang || 'tr'} onChange={(e) => set({ lang: e.target.value })}>
              {Object.entries(LANGS).map(([c, l]) => <option key={c} value={c}>{l.name}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label>{ui('set_mode')}</label>
          <div className="mode-cards">
            {['tr', 'bi', 'fr'].map((m) => (
              <button type="button" key={m} className="mode-card" aria-pressed={state.settings.mode === m} onClick={() => set({ mode: m })}>
                <span className="flag"><ModeFlag mode={m} h={22} /></span>
                <span><b>{ui('mode_' + m)}</b><br /><span className="muted small">{ui('mode_' + m + '_desc')}</span></span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="goal">{ui('set_goal')}</label>
            <input id="goal" type="number" min={5} max={200} step={5} className="input" value={state.settings.dailyGoal}
              onChange={(e) => set({ dailyGoal: Math.max(5, Math.min(200, Number(e.target.value) || 20)) })} />
          </div>
          <div className="field">
            <label htmlFor="exam">{ui('set_exam_date')}</label>
            <input id="exam" type="date" className="input" value={state.settings.examDate} onChange={(e) => set({ examDate: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>{ui('set_theme')}</label>
          <div className="modes" style={{ justifySelf: 'start' }}>
            {[['auto', '🖥️'], ['light', '☀️'], ['dark', '🌙']].map(([t, ico]) => (
              <button type="button" key={t} aria-pressed={state.settings.theme === t} onClick={() => set({ theme: t })}>{ico} {ui('theme_' + t)}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="rate">{ui('set_tts')} : {state.settings.ttsRate.toFixed(2)}</label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input id="rate" type="range" min={0.6} max={1.2} step={0.05} value={state.settings.ttsRate} style={{ flex: 1 }}
              onChange={(e) => set({ ttsRate: Number(e.target.value) })} />
            <button type="button" className="btn small" onClick={() => speak('Liberté, égalité, fraternité. Bonjour, je prépare l\'examen civique.', { rate: state.settings.ttsRate })}>🔊 {ui('set_tts_test')}</button>
          </div>
        </div>
        <VoiceSettings engine={state.settings.voice || 'natural'} setEngine={(v) => set({ voice: v })} rate={state.settings.ttsRate} />
      </section>

      <AiSettings ai={ai} aiOn={aiOn} setAiOn={(on) => set({ ai: on ? 'on' : 'off' })} refreshAi={refreshAi} model={state.settings.model} setModel={(m) => set({ model: m })}
        speed={state.settings.aiSpeed} setSpeed={(sp) => set({ aiSpeed: sp })} system={systemPrompt({ name: state.profile.name, mode: state.settings.mode })} />

      <section className="panel settings-grid">
        <h2><U k="set_backup" dual /></h2>
        <p className="muted small">{storageKind() === 'server' ? ui('saved_where') : ui('saved_where_browser')}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={exportData}>⬇ {ui('export')}</button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>⬆ {ui('import')}</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
          <button type="button" className="btn danger" onClick={() => {
            if (window.confirm(ui('reset_confirm'))) {
              const fresh = initialState();
              setState({ ...fresh, profile: { ...fresh.profile, name: state.profile.name, setupDone: true }, settings: state.settings });
            }
          }}>🗑 {ui('reset')}</button>
        </div>
      </section>

      <section className="panel settings-grid">
        <h2><U k="about_title" dual /></h2>
        <p className="small">⚠️ {ui('about_unofficial')}</p>
        <ul className="small about-links">
          <li><a href="https://www.service-public.fr/" target="_blank" rel="noreferrer">service-public.fr</a></li>
          <li><a href="https://formation-civique.interieur.gouv.fr/" target="_blank" rel="noreferrer">formation-civique.interieur.gouv.fr</a></li>
        </ul>
        <p className="muted small">
          {ui('about_license')} · <a href="https://github.com/minihollow/passeport-civique" target="_blank" rel="noreferrer">github.com/minihollow/passeport-civique</a>
        </p>
        <p className="muted small">{uiIdx ? 'Sürüm' : 'Version'} 2.0 · 190 + 60 questions</p>
      </section>
    </div>
  );
}

function AiSettings({ ai, aiOn, setAiOn, refreshAi, model, setModel, speed, setSpeed, system }) {
  const { ui, pick } = useLang();
  const [pulling, setPulling] = useState(null); // { name, pct, status }
  const [err, setErr] = useState('');
  const [testing, setTesting] = useState(false);
  const gpu = gpuInfo();
  const rec = recommendedModel(ai.system?.vram_mb, gpu);
  const installedNames = MODELS.filter((m) => hasModel(ai.status, m.name)).map((m) => m.name);
  const active = model && hasModel(ai.status, model) ? model : installedNames.includes(rec) ? rec : installedNames[0] || ai.status.models?.[0]?.name || '';
  const level = speed?.model === active ? speedLevel(speed.tps) : null;
  const smaller = MODELS[MODELS.findIndex((m) => m.name === active) + 1]?.name;

  const test = async () => {
    setErr(''); setTesting(true);
    try {
      const { tps } = await warmUp(active, system);
      if (tps) setSpeed({ model: active, tps: Math.round(tps * 10) / 10 });
    } catch (e) { setErr(String(e.message || e)); } finally { setTesting(false); }
  };

  const download = async (name) => {
    setErr('');
    setPulling({ name, pct: 0, status: '' });
    try {
      await pullModel(name, (ev) => {
        const pct = ev.total ? ev.completed / ev.total : null;
        setPulling((p) => ({ name, pct: pct ?? p?.pct ?? 0, status: ev.status || '' }));
      });
      setModel(name);
      await refreshAi();
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setPulling(null);
    }
  };

  return (
    <section className="panel settings-grid">
      <div className="panel-head" style={{ marginBottom: 0 }}>
        <h2>🐓 <U k="set_ai" dual /></h2>
        {aiOn && <button type="button" className="btn small" onClick={refreshAi}>↻ {ui('ai_check')}</button>}
      </div>
      <div className="modes" style={{ justifySelf: 'start' }}>
        <button type="button" aria-pressed={aiOn} onClick={() => setAiOn(true)}>🐓 {ui('ai_mode_on')}</button>
        <button type="button" aria-pressed={!aiOn} onClick={() => setAiOn(false)}>📖 {ui('ai_mode_off')}</button>
      </div>
      <p className="muted small">{ui('ai_mode_desc')}</p>
      {aiOn && <>
      <div>
        <span className={`status-dot ${ai.status.running ? 'on' : 'off'}`} />
        {ai.status.running ? `Ollama ${ai.status.version || ''}` : ui('ai_no_ollama')}
        {ai.system?.gpu_name
          ? <span className="muted small"> · {ai.system.gpu_name} ({Math.round((ai.system.vram_mb || 0) / 1024)} Go)</span>
          : gpu.name && <span className="muted small"> · {gpu.name}</span>}
      </div>
      {ai.status.running && active && (
        <div className="speed-row">
          <span>{ui('ai_speed')} <b>{active}</b> : {level ? <b className={`speed-${level}`}>{ui('speed_' + level)} · {speed.tps} {ui('ai_tps')}</b> : <span className="muted">—</span>}</span>
          <button type="button" className="btn small" disabled={testing} onClick={test}>{testing ? '…' : '⏱ ' + ui('ai_test')}</button>
        </div>
      )}
      {level === 'slow' && <p className="small" style={{ color: 'var(--sun-ink)' }}>🐢 {smaller ? ui('ai_slow_smaller').replace('{m}', smaller) : ui('ai_slow_off')}</p>}
      {!ai.status.running && <OllamaHelp />}
      <div className="model-list">
        {MODELS.map((m) => {
          const installed = hasModel(ai.status, m.name);
          const isActive = active === m.name;
          return (
            <div key={m.name} className={`model-card ${isActive ? 'active' : ''}`}>
              <div>
                <b>{m.name}</b> {m.size && <span className="muted small">{m.size}</span>}
                {m.name === rec && <span className="tag mode-fr" style={{ marginLeft: 8 }}>{ui('ai_recommended')}</span>}
                {installed && <span className="tag pass" style={{ marginLeft: 8 }}>{ui('ai_installed')}</span>}
                <div className="muted small">{pick(m.desc)}</div>
                {pulling?.name === m.name && (
                  <div style={{ marginTop: 8 }}>
                    <div className="dl-bar"><span style={{ width: `${Math.round((pulling.pct || 0) * 100)}%` }} /></div>
                    <span className="small muted">{ui('ai_downloading')} {Math.round((pulling.pct || 0) * 100)} % · {pulling.status}</span>
                  </div>
                )}
              </div>
              <div>
                {installed
                  ? <button type="button" className="btn small" disabled={isActive} onClick={() => setModel(m.name)}>{isActive ? '✓' : ui('ai_use')}</button>
                  : <button type="button" className="btn small primary" disabled={!ai.status.running || !!pulling} onClick={() => download(m.name)}>⬇ {ui('ai_download')}</button>}
              </div>
            </div>
          );
        })}
        {ai.status.models?.filter((m) => !MODELS.some((x) => hasModel({ models: [m] }, x.name))).map((m) => (
          <div key={m.name} className={`model-card ${active === m.name ? 'active' : ''}`}>
            <div><b>{m.name}</b> <span className="tag pass">{ui('ai_installed')}</span></div>
            <button type="button" className="btn small" disabled={active === m.name} onClick={() => setModel(m.name)}>{active === m.name ? '✓' : ui('ai_use')}</button>
          </div>
        ))}
      </div>
      {err && <p className="ans-ko small">{err}</p>}
      </>}
    </section>
  );
}

// How to connect Coco: install Ollama and, in the web version, allow this site to use it.
function OllamaHelp() {
  const { ui } = useLang();
  const origin = location.origin;
  const isMac = /Mac/i.test(navigator.platform || navigator.userAgent);
  const cmd = isMac ? `launchctl setenv OLLAMA_ORIGINS "${origin}"` : `setx OLLAMA_ORIGINS "${origin}"`;
  const copy = () => navigator.clipboard?.writeText(cmd).catch(() => {});
  return (
    <ol className="ollama-help small">
      <li>{ui('ollama_step_install')} <a href="https://ollama.com/download" target="_blank" rel="noreferrer">ollama.com/download</a></li>
      {!viaProxy() && (
        <li>
          {ui(isMac ? 'ollama_step_allow_mac' : 'ollama_step_allow_win')}
          <div className="cmd-row"><code>{cmd}</code><button type="button" className="btn small" onClick={copy}>📋 {ui('copy')}</button></div>
        </li>
      )}
      <li>{ui(viaProxy() ? 'ollama_step_restart_app' : 'ollama_step_restart')}</li>
      {!viaProxy() && <li>{ui('ollama_step_permission')}</li>}
    </ol>
  );
}

// Reading voice: natural Piper voice (downloaded once per language) or browser voice.
function VoiceSettings({ engine, setEngine, rate }) {
  const { ui, help } = useLang();
  const [have, setHave] = useState({});
  const [loading, setLoading] = useState(null); // { lang, pct }
  const [err, setErr] = useState('');
  useEffect(() => { refreshInstalled().then(setHave); }, []);
  const langs = ['fr', help].filter((l, i, a) => PIPER_VOICES[l] && a.indexOf(l) === i);
  const install = async (lang) => {
    setErr(''); setLoading({ lang, pct: 0 });
    try { await installVoice(lang, (pct) => setLoading({ lang, pct })); setHave(await refreshInstalled()); }
    catch (e) { setErr(String(e.message || e)); }
    finally { setLoading(null); }
  };
  const remove = async (lang) => { await removeVoice(lang); setHave(await refreshInstalled()); };
  // Sample sentence: in French, or Coco's greeting in the help language.
  const sample = (l) => (l === 'fr' ? 'Bonjour ! La France est une République laïque, démocratique et sociale.' : UI.coco_hello[1]);

  return (
    <div className="field">
      <label>{ui('voice_title')}</label>
      <div className="modes" style={{ justifySelf: 'start' }}>
        <button type="button" aria-pressed={engine === 'natural'} onClick={() => setEngine('natural')}>✨ {ui('voice_natural')}</button>
        <button type="button" aria-pressed={engine === 'system'} onClick={() => setEngine('system')}>🔈 {ui('voice_system')}</button>
      </div>
      {engine === 'natural' && (
        <>
          <p className="muted small">{ui('voice_natural_desc')}</p>
          <div className="model-list">
            {langs.map((l) => {
              const v = PIPER_VOICES[l];
              return (
                <div key={l} className={`model-card ${have[l] ? 'active' : ''}`}>
                  <div>
                    <b>{l === 'fr' ? 'Français' : helpInfo().name}</b> · {v.name} <span className="muted small">≈ {v.size} Mo · {v.license}</span>
                    {have[l] && <span className="tag pass" style={{ marginLeft: 8 }}>{ui('ai_installed')}</span>}
                    {loading?.lang === l && (
                      <div style={{ marginTop: 8 }}>
                        <div className="dl-bar"><span style={{ width: `${Math.round(loading.pct * 100)}%` }} /></div>
                        <span className="small muted">{ui('ai_downloading')} {Math.round(loading.pct * 100)} %</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {have[l] ? <>
                      <button type="button" className="btn small" onClick={() => speak(sample(l), { lang: l === 'fr' ? 'fr-FR' : helpInfo().locale, rate })}>🔊</button>
                      <button type="button" className="btn small" title={ui('voice_remove')} aria-label={ui('voice_remove')} onClick={() => remove(l)}>🗑</button>
                    </> : <button type="button" className="btn small primary" disabled={!!loading} onClick={() => install(l)}>⬇ {ui('ai_download')}</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {err && <p className="ans-ko small">{err}</p>}
    </div>
  );
}
