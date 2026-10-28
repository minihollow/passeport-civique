import { useMemo, useState } from 'react';
import { Stamp, Tx, U, useLang, Meter, fmtDate } from '../components/common.jsx';
import { useStore } from '../lib/store.js';
import { Q_BY_ID, BADGES, formatDuration, rightIn } from '../lib/quiz.js';
import { THEMES, EXAM } from '../data/themes.js';
import { useSessionStats } from './Session.jsx';
import { helpInfo } from '../lang/langs.js';

const LETTERS = ['A', 'B', 'C', 'D'];

export default function Result({ sessionId, freshBadges = [], go, startAgain, askAbout }) {
  const { state } = useStore();
  const { ui, uiIdx, pick } = useLang();
  const session = state.sessions.find((s) => s.id === sessionId);
  const stats = useSessionStats(session);
  const [onlyMistakes, setOnlyMistakes] = useState(true);
  const fresh = useMemo(() => BADGES.filter((b) => freshBadges.includes(b.id)), [freshBadges]);
  if (!session) return <div className="page"><p>—</p></div>;

  const isExam = session.type === 'exam';
  const pct = session.total ? session.correct / session.total : 0;
  const ok = isExam ? session.passed : pct >= 0.8;
  const xp = session.answers.reduce((a, x) => a + (x.ok ? 10 : 2), 0) + (isExam ? (session.passed ? 100 : 20) : 0);
  const list = session.answers.filter((a) => !onlyMistakes || !a.ok);
  const typeKey = { daily: 'type_daily', theme: 'type_theme', exam: 'type_exam', mistakes: 'type_mistakes' }[session.type];

  return (
    <div className="page">
      <section className="panel result-hero">
        <div style={{ display: 'grid', gap: 12 }}>
          <span className="muted">{ui(typeKey)} · {fmtDate(session.end, uiIdx, true)} · {formatDuration(session.end - session.start)}</span>
          <h1>{isExam ? ui(ok ? 'result_pass' : 'result_fail') : ui('result_series_done')}</h1>
          <div className="score-big">{session.correct}<small> / {session.total} {ui('result_score')}</small></div>
          {isExam && <p className="muted"><U k="result_need" /></p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="pill sun">⭐ +{xp} {ui('xp_won')}</span>
            <span className={`tag mode-${session.mode}`}>{ui('mode_' + session.mode)}</span>
            {session.level && <span className="tag">{ui('lvl_' + session.level)}</span>}
          </div>
        </div>
        <div className="stamp-drop">
          <Stamp className="stamp-anim" size={190} rotate={-12}
            color={ok ? 'var(--ok)' : isExam ? 'var(--ko)' : 'var(--stamp)'}
            top={ui(isExam ? (ok ? 'stamp_pass' : 'stamp_retry') : 'stamp_done')}
            center={`${session.correct}/${session.total}`}
            bottom={new Date(session.end).toLocaleDateString(uiIdx ? helpInfo().locale : 'fr-FR')} />
        </div>
      </section>

      {fresh.length > 0 && (
        <section className="panel" style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          {fresh.map((b) => (
            <div key={b.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Stamp size={84} color={b.color} top={pick(b.short)} center={b.icon} rotate={-8} />
              <div><b>{pick(b.name)}</b><div className="muted small">{ui('my_stamps')} +1</div></div>
            </div>
          ))}
        </section>
      )}

      {Object.keys(stats.byTheme).length > 1 && (
        <section className="panel">
          <div className="panel-head"><h2><U k="by_theme" /></h2></div>
          <div className="theme-scores">
            {THEMES.filter((t) => stats.byTheme[t.id]).map((t) => {
              const b = stats.byTheme[t.id];
              return (
                <div className="theme-score" key={t.id}>
                  <div>
                    <div>{t.icon} {pick(t.name)}</div>
                    <Meter value={b.ok / b.n} color={b.ok / b.n >= 0.8 ? 'var(--ok)' : b.ok / b.n >= 0.5 ? 'var(--sun)' : 'var(--ko)'} />
                  </div>
                  <div className="num"><b>{b.ok}</b> / {b.n}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn primary" onClick={startAgain}>↻ <U k="again" /></button>
        <button type="button" className="btn" onClick={() => go('home')}><U k="back_home" /></button>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2><U k="review_answers" /></h2>
          <label className="small" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={onlyMistakes} onChange={(e) => setOnlyMistakes(e.target.checked)} />
            {ui('only_mistakes')}
          </label>
        </div>
        {list.length === 0 && <p className="muted">🎉 {ui('correct')}</p>}
        {list.map((a) => {
          const q = Q_BY_ID[a.id];
          if (!q) return null;
          const n = session.answers.indexOf(a) + 1;
          const order = a.order || [0, 1, 2, 3];
          return (
            <div className="review-item" key={a.id}>
              <div className="review-q"><span className={a.ok ? 'ans-ok' : 'ans-ko'}>{a.ok ? '✓' : '✗'}</span><span>{n}. <Tx v={q.q} /></span></div>
              <div className="review-ans">
                {!a.ok && (
                  <div className="ans-ko">{ui('your_answer')} : {a.c == null ? ui('no_answer') : <>{LETTERS[order.indexOf(a.c)]}) <Tx v={q.o[a.c]} /></>}</div>
                )}
                <div className="ans-ok">{ui('right_answer_was')} {LETTERS[order.indexOf(rightIn(q, order))]}) <Tx v={q.o[rightIn(q, order)]} /></div>
                <div className="muted"><Tx v={q.x} /></div>
                {askAbout && <div><button type="button" className="btn small ghost" onClick={() => askAbout({ id: a.id, order, chosen: a.c })}>🐓 <U k="ask_coco" /></button></div>}
              </div>
            </div>
          );
        })}
      </section>
      {isExam && <p className="muted small">{EXAM.total} questions · {EXAM.minutes} min · {EXAM.pass}/{EXAM.total}</p>}
    </div>
  );
}
