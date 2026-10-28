import { useState } from 'react';
import { CocoAvatar, ModeFlag } from '../components/common.jsx';
import { useStore, newProfile, newProfileId } from '../lib/store.js';
import { UI, MODES } from '../data/i18n.js';
import { LANGS, applyLang, helpLang } from '../lang/langs.js';
import { gpuInfo, recommendedModel } from '../lib/ai.js';

// Profile creation (first launch or new profile), in 3 screens:
// 1. help language and study mode, 2. first name and exam date, 3. with or without Coco (AI).
// Texts shown in the help language and in French. onCancel: back to the profile choice.
export default function Setup({ ai, onCancel }) {
  const { setRoot, openProfile } = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [mode, setMode] = useState('tr');
  const [lang, setLang] = useState(helpLang());
  const [withAi, setWithAi] = useState(null);
  const chooseLang = (code) => applyLang(code).then(setLang);
  const both = (k) => (<>{UI[k][1]}<span className="sub-tr" style={{ color: 'var(--ink-3)' }}>{UI[k][0]}</span></>);
  const line = (k) => (<p className="muted">{UI[k][1]}<br /><span className="small">{UI[k][0]}</span></p>);

  const running = !!ai?.status.running;
  const aiOn = withAi ?? running;
  const rec = recommendedModel(ai?.system?.vram_mb);
  const gpu = ai?.system?.gpu_name || gpuInfo().name;

  const done = () => {
    const id = newProfileId();
    const p = newProfile(name.trim(), mode, lang);
    p.settings = { ...p.settings, examDate, ai: aiOn ? 'on' : 'off' };
    setRoot((r) => ({ ...r, profiles: { ...r.profiles, [id]: p } }));
    openProfile(id);
  };

  const steps = [
    <>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <CocoAvatar size={72} />
        <h1>{both('setup_welcome')}</h1>
      </div>
      {line('setup_intro')}
      {Object.keys(LANGS).length > 1 && (
        <div className="field">
          <label htmlFor="setup-lang">{both('set_lang')}</label>
          <select id="setup-lang" className="input" value={lang} onChange={(e) => chooseLang(e.target.value)}>
            {Object.entries(LANGS).map(([c, l]) => <option key={c} value={c}>{l.name}</option>)}
          </select>
        </div>
      )}
      <div className="field">
        <label>{both('setup_mode')}</label>
        <div className="mode-cards">
          {MODES.map((m) => (
            <button type="button" key={m} className="mode-card" aria-pressed={mode === m} onClick={() => setMode(m)}>
              <span className="flag"><ModeFlag mode={m} h={22} /></span>
              <span><b>{UI['mode_' + m][1]}</b><br /><span className="muted small">{UI['mode_' + m + '_desc'][1]}</span></span>
            </button>
          ))}
        </div>
        <span className="muted small">{UI.setup_mode_later[1]} · {UI.setup_mode_later[0]}</span>
      </div>
      <span className="muted small">{UI.setup_unofficial[1]} · {UI.setup_unofficial[0]}</span>
    </>,
    <>
      <h1>{both('setup_name')}</h1>
      <div className="field">
        <input id="setup-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) setStep(2); }} />
      </div>
      <div className="field">
        <label htmlFor="setup-exam">{both('setup_exam_date')}</label>
        <input id="setup-exam" type="date" className="input" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
      </div>
    </>,
    <>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <CocoAvatar size={64} />
        <h1>{both('setup_ai_title')}</h1>
      </div>
      {line('setup_ai_intro')}
      <div className={`ai-check ${running ? 'on' : 'off'}`}>
        {running
          ? <>✅ {UI.setup_ai_found[1]}<br /><span className="small">{UI.setup_ai_found[0]}{gpu && ` · ${gpu}`} · {UI.ai_recommended[0]} : <b>{rec}</b></span></>
          : <>ℹ️ {UI.setup_ai_missing[1]}<br /><span className="small">{UI.setup_ai_missing[0]}</span></>}
      </div>
      <div className="mode-cards">
        <button type="button" className="mode-card" aria-pressed={aiOn} onClick={() => setWithAi(true)}>
          <span className="flag">🐓</span>
          <span><b>{UI.ai_mode_on[1]}</b><br /><span className="muted small">{UI.setup_ai_on_desc[1]}</span></span>
        </button>
        <button type="button" className="mode-card" aria-pressed={!aiOn} onClick={() => setWithAi(false)}>
          <span className="flag">📖</span>
          <span><b>{UI.ai_mode_off[1]}</b><br /><span className="muted small">{UI.setup_ai_off_desc[1]}</span></span>
        </button>
      </div>
      <span className="muted small">{UI.setup_ai_later[1]} · {UI.setup_ai_later[0]}</span>
    </>,
  ];
  const canNext = step !== 1 || !!name.trim();
  const last = step === steps.length - 1;

  return (
    <div className="setup">
      <div className="setup-card">
        <div className="setup-dots" aria-label={`${step + 1} / ${steps.length}`}>
          {steps.map((_, i) => <span key={i} className={i <= step ? 'on' : ''} />)}
        </div>
        {steps[step]}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {last
            ? <button type="button" className="btn primary" onClick={done}>{UI.setup_go[1]} · {UI.setup_go[0]}</button>
            : <button type="button" className="btn primary" disabled={!canNext} onClick={() => setStep(step + 1)}>{UI.next[1]} · {UI.next[0]}</button>}
          {step > 0 && <button type="button" className="btn" onClick={() => setStep(step - 1)}>{UI.back[1]} · {UI.back[0]}</button>}
          {step === 0 && onCancel && <button type="button" className="btn" onClick={onCancel}>{UI.cancel[1]} · {UI.cancel[0]}</button>}
        </div>
      </div>
    </div>
  );
}
