import { U, useLang, Tx, SpeakBtn } from '../components/common.jsx';
import { THEME_BY_ID } from '../data/themes.js';
import { LESSONS } from '../lib/lessons.js';
import { helpInfo, helpLang } from '../lang/langs.js';

// Course to read, without a quiz: one sub-theme (s), or every sub-theme of a theme (no s).
export default function Lesson({ t, s, go, start }) {
  const { ui } = useLang();
  const theme = THEME_BY_ID[t];
  const lessons = LESSONS.filter((l) => l.t === t && (!s || l.s === s));
  if (!theme || !lessons.length) return null;
  const single = s ? lessons[0] : null;
  const subOf = (id) => theme.subs.find((x) => x.id === id)?.name;
  const i = single ? LESSONS.indexOf(single) : -1;
  const next = single && LESSONS[i + 1];

  return (
    <div className="page lesson" style={{ maxWidth: 760 }}>
      <div>
        <button type="button" className="btn ghost small" onClick={() => go('practice', { theme: t })}>← <U k="lesson_back" /></button>
      </div>
      <header className="lesson-head">
        <span className="muted">{theme.icon} <Title v={theme.name} /></span>
        <h1><Title v={single ? subOf(s) : theme.name} /></h1>
        <p className="muted small">{ui('lesson_hint')}</p>
      </header>

      {lessons.map((l) => (
        <article className="panel lesson-body" key={l.s}>
          {!single && <h2 className="lesson-sub"><Title v={subOf(l.s)} /></h2>}
          <Para v={l.intro} intro />
          {l.parts.map((p, k) => (
            <section key={k} className="lesson-part">
              <h3><Title v={p.h} /></h3>
              {p.p.map((x, j) => <Para key={j} v={x} />)}
            </section>
          ))}
          <div className="lesson-keys">
            <h3>⭐ <U k="lesson_keys" /></h3>
            <ul>{l.keys.map((k, j) => <li key={j}><Tx v={k} block /></li>)}</ul>
          </div>
          <div className="lesson-words">
            <h3>📚 <U k="lesson_words" /></h3>
            <div className="vocab-chips">
              {l.v.map((w) => (
                <span className="vchip" key={w[0]}>
                  <span className="fr" lang="fr">{w[0]}</span>
                  <span className="tr" lang={helpLang()} dir="auto">{w[1]}</span>
                  <SpeakBtnSmall text={w[0]} />
                </span>
              ))}
            </div>
          </div>
        </article>
      ))}

      <div className="lesson-foot">
        <button type="button" className="btn primary" onClick={() => start('theme', { theme: t, sub: s })}>▶ <U k="lesson_practice" /></button>
        {next && (
          <button type="button" className="btn" onClick={() => go('lesson', { t: next.t, s: next.s })}>
            <U k="lesson_next" /> →
          </button>
        )}
      </div>
    </div>
  );
}

// Title [fr, help]: help language only, French only, or French with the translation below (bilingual).
function Title({ v }) {
  const { mode, pick } = useLang();
  if (!v) return null;
  return <>{pick(v)}{mode === 'bi' && <span className="sub-tr">{v[1]}</span>}</>;
}

// Paragraph with a button that reads it aloud (in the language shown).
function Para({ v, intro = false }) {
  const { mode } = useLang();
  const helpShown = mode === 'tr';
  return (
    <div className={`lesson-p${intro ? ' intro' : ''}`}>
      <p><Tx v={v} block /></p>
      <SpeakBtn text={helpShown ? v[1] : v[0]} lang={helpShown ? helpInfo().locale : 'fr-FR'} />
    </div>
  );
}

function SpeakBtnSmall({ text }) {
  return <SpeakBtn text={text} style={{ width: 28, height: 28, fontSize: '0.8rem' }} />;
}
