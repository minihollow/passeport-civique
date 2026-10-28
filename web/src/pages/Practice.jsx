import { useEffect, useRef } from 'react';
import { U, useLang, Meter } from '../components/common.jsx';
import { useStore } from '../lib/store.js';
import { masteryOf, QUESTIONS } from '../lib/quiz.js';
import { THEMES } from '../data/themes.js';

export default function Practice({ start, focusTheme }) {
  const { state } = useStore();
  const { ui, pick, mode } = useLang();
  const refs = useRef({});
  useEffect(() => { if (focusTheme) refs.current[focusTheme]?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [focusTheme]);

  return (
    <div className="page">
      <h1><U k="practice_title" dual /></h1>
      {THEMES.map((t) => {
        const m = masteryOf(state, (q) => q.t === t.id);
        return (
          <section className="panel theme-block" key={t.id} ref={(el) => { refs.current[t.id] = el; }}>
            <div className="panel-head" style={{ marginBottom: 4 }}>
              <h2>{t.icon} {pick(t.name)}{mode === 'bi' && <span className="sub-tr">{t.name[1]}</span>}</h2>
              <span className="muted small">{Math.round(m.pct * 100)} % {ui('mastered')}</span>
            </div>
            <div className="subs">
              <button type="button" className="sub-card all" onClick={() => start('theme', { theme: t.id })}>
                <b>▶ <U k="practice_all" /></b>
                <span className="muted small">{m.total} {ui('practice_sub_q')}</span>
              </button>
              {t.subs.map((s) => {
                const sm = masteryOf(state, (q) => q.t === t.id && q.s === s.id);
                const count = QUESTIONS.filter((q) => q.t === t.id && q.s === s.id).length;
                return (
                  <button type="button" className="sub-card" key={s.id} onClick={() => start('theme', { theme: t.id, sub: s.id })}>
                    <b>{pick(s.name)}</b>
                    {mode === 'bi' && <span className="sub-tr">{s.name[1]}</span>}
                    <span className="muted small">{count} {ui('practice_sub_q')} · {sm.mastered} {ui('mastered')}</span>
                    <Meter value={sm.pct} />
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
