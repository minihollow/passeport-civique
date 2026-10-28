import { useEffect, useState } from 'react';
import { UI } from '../data/i18n.js';
import { useLang } from './common.jsx';
import { useStore } from '../lib/store.js';

// Guided tour: a few cards after creating a profile (and from Settings).
const SLIDES = [
  { id: 'daily', icon: '▶️' },
  { id: 'lang', icon: '🌍' },
  { id: 'exam', icon: '📝' },
  { id: 'progress', icon: '📈' },
  { id: 'coco', icon: '🐓', ai: true },
  { id: 'save', icon: '💾' },
];

export default function Tour({ aiOn }) {
  const { setState } = useStore();
  const { mode, uiIdx } = useLang();
  const [i, setI] = useState(0);
  const slides = SLIDES.filter((s) => !s.ai || aiOn);
  const s = slides[i];
  const last = i === slides.length - 1;
  const close = () => setState((st) => ({ ...st, profile: { ...st.profile, tourDone: true } }));
  // Text in the interface language; in 'French + help' mode, the translation below.
  const T = ({ k, cls }) => (
    <>
      <span className={cls}>{UI[k][uiIdx]}</span>
      {mode === 'bi' && <span className="sub-tr">{UI[k][1]}</span>}
    </>
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight' && !last) setI(i + 1);
      if (e.key === 'ArrowLeft' && i > 0) setI(i - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="tour-back" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-card">
        <div className="tour-icon" aria-hidden="true">{s.icon}</div>
        <h2 id="tour-title"><T k={`tour_${s.id}_t`} /></h2>
        <p><T k={`tour_${s.id}_x`} /></p>
        <div className="setup-dots">{slides.map((x, k) => <span key={x.id} className={k <= i ? 'on' : ''} />)}</div>
        <div className="tour-actions">
          <button type="button" className="btn ghost" onClick={close}>{UI.tour_skip[uiIdx]}</button>
          <span style={{ flex: 1 }} />
          {i > 0 && <button type="button" className="btn" onClick={() => setI(i - 1)}>{UI.back[uiIdx]}</button>}
          {last
            ? <button type="button" className="btn primary" onClick={close} autoFocus>{UI.tour_done[uiIdx]}</button>
            : <button type="button" className="btn primary" onClick={() => setI(i + 1)} autoFocus>{UI.next[uiIdx]}</button>}
        </div>
      </div>
    </div>
  );
}
