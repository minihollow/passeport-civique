import { useMemo, useState } from 'react';
import { Tx, U, useLang, Meter, fmtDate } from '../components/common.jsx';
import { useStore, todayKey } from '../lib/store.js';
import { QUESTIONS, masteryOf, qStat, formatDuration } from '../lib/quiz.js';
import { THEMES, EXAM } from '../data/themes.js';
import { helpInfo } from '../lang/langs.js';

export default function Progress({ go }) {
  const { state } = useStore();
  const { ui, pick, uiIdx, mode } = useLang();
  const days = Object.values(state.days);
  const answered = days.reduce((a, d) => a + d.answered, 0);
  const correct = days.reduce((a, d) => a + d.correct, 0);
  const m = masteryOf(state);
  const exams = state.sessions.filter((s) => s.type === 'exam' && s.end);
  const passed = exams.filter((s) => s.passed).length;

  const byMode = useMemo(() => {
    const out = { tr: [0, 0], bi: [0, 0], fr: [0, 0] };
    for (const s of state.sessions) {
      if (!out[s.mode]) continue;
      out[s.mode][0] += s.correct; out[s.mode][1] += s.total;
    }
    return out;
  }, [state.sessions]);

  const hardest = useMemo(() => QUESTIONS
    .map((q) => ({ q, s: qStat(state, q.id) }))
    .filter((x) => x.s.ko > 0)
    .sort((a, b) => (b.s.ko / b.s.seen) - (a.s.ko / a.s.seen) || b.s.ko - a.s.ko)
    .slice(0, 8), [state]);

  return (
    <div className="page">
      <h1><U k="progress_title" dual /></h1>

      <section className="kpis">
        <div className="kpi"><span className="muted small">{ui('stat_answered')}</span><b>{answered}</b></div>
        <div className="kpi"><span className="muted small">{ui('stat_accuracy')}</span><b>{answered ? Math.round((100 * correct) / answered) : 0} %</b></div>
        <div className="kpi"><span className="muted small">{ui('stat_mastered')}</span><b>{m.mastered}<span className="muted" style={{ fontSize: '1rem', fontWeight: 500 }}> / {m.total}</span></b></div>
        <div className="kpi"><span className="muted small">{ui('stat_exams')}</span><b>{passed}<span className="muted" style={{ fontSize: '1rem', fontWeight: 500 }}> / {exams.length}</span></b></div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2><U k="exams_chart" dual /></h2><span className="muted small">{EXAM.pass}/{EXAM.total} = {ui('pass_line')}</span></div>
        {exams.length ? <ExamChart exams={exams} uiIdx={uiIdx} ui={ui} /> : <p className="muted">{ui('exams_chart_empty')}</p>}
      </section>

      <div className="grid2">
        <section className="panel">
          <div className="panel-head"><h2><U k="calendar" dual /></h2></div>
          <Calendar days={state.days} uiIdx={uiIdx} ui={ui} />
        </section>
        <section className="panel">
          <div className="panel-head"><h2><U k="by_mode" dual /></h2></div>
          <div style={{ display: 'grid', gap: 14 }}>
            {['tr', 'bi', 'fr'].map((k) => {
              const [ok, n] = byMode[k];
              return (
                <div key={k}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className={`tag mode-${k}`}>{ui('mode_' + k)}</span>
                    <span className="num">{n ? `${Math.round((100 * ok) / n)} %` : '—'} <span className="muted small">({ok}/{n})</span></span>
                  </div>
                  <Meter value={n ? ok / n : 0} color={k === 'tr' ? 'var(--tr)' : k === 'bi' ? 'var(--sun)' : 'var(--stamp)'} />
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><h2><U k="mastery_by_theme" dual /></h2><span className="muted small">{ui('mastered')} / total</span></div>
        {THEMES.map((t) => (
          <div key={t.id} style={{ marginBottom: 14 }}>
            <h3 style={{ margin: '6px 0' }}>{t.icon} {pick(t.name)}</h3>
            {t.subs.map((s) => {
              const sm = masteryOf(state, (q) => q.t === t.id && q.s === s.id);
              return (
                <div className="sub-mastery" key={s.id}>
                  <span>{pick(s.name)}{mode === 'bi' && <span className="sub-tr">{s.name[1]}</span>}</span>
                  <Meter value={sm.pct} />
                  <span className="num small">{sm.mastered}/{sm.total}</span>
                </div>
              );
            })}
          </div>
        ))}
      </section>

      {hardest.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2><U k="hardest" dual /></h2><button type="button" className="btn small" onClick={() => go('mistakes')}>🔁 <U k="review_mistakes" /></button></div>
          {hardest.map(({ q, s }) => (
            <div className="review-item" key={q.id}>
              <div className="review-q"><span style={{ flex: 1 }}><Tx v={q.q} /></span><span className="tag fail">{s.ko}/{s.seen}</span></div>
              <div className="review-ans"><div className="ans-ok">✓ <Tx v={q.o[0]} /></div></div>
            </div>
          ))}
        </section>
      )}

      <section className="panel">
        <div className="panel-head"><h2><U k="history" dual /></h2></div>
        {state.sessions.length === 0 ? <p className="muted">{ui('history_empty')}</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="hist">
              <thead><tr><th>{ui('col_date')}</th><th>{ui('col_type')}</th><th>{ui('col_mode')}</th><th className="num">{ui('col_score')}</th><th className="num">{ui('col_time')}</th><th /></tr></thead>
              <tbody>
                {state.sessions.slice().reverse().slice(0, 100).map((s) => (
                  <tr key={s.id} className="clickable" onClick={() => go('result', { sessionId: s.id })} tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') go('result', { sessionId: s.id }); }}>
                    <td>{fmtDate(s.end, uiIdx, true)}</td>
                    <td>{ui({ daily: 'type_daily', theme: 'type_theme', exam: 'type_exam', mistakes: 'type_mistakes' }[s.type])}
                      {s.theme && <span className="muted small"> · {pick(THEMES.find((t) => t.id === s.theme)?.name || ['', ''])}</span>}
                      {s.level && <span className="muted small"> · {ui('lvl_' + s.level)}</span>}</td>
                    <td><span className={`tag mode-${s.mode}`}>{ui('mode_' + s.mode)}</span></td>
                    <td className="num"><b>{s.correct}</b>/{s.total}</td>
                    <td className="num muted">{formatDuration(s.end - s.start)}</td>
                    <td>{s.type === 'exam' && <span className={`tag ${s.passed ? 'pass' : 'fail'}`}>{s.passed ? '✓ ' + ui('result_pass') : '✗'}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// Mock exam chart (single series) with the 32/40 line.
function ExamChart({ exams, uiIdx, ui }) {
  const [hover, setHover] = useState(null);
  const W = 860; const H = 260; const P = { l: 40, r: 70, t: 16, b: 34 };
  const n = exams.length;
  const x = (i) => P.l + (n === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (n - 1));
  const y = (v) => P.t + (1 - v / EXAM.total) * (H - P.t - P.b);
  const pts = exams.map((e, i) => [x(i), y(e.correct)]);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const onMove = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(p[0] - px) < Math.abs(pts[best][0] - px)) best = i; });
    setHover(best);
  };
  const last = exams[n - 1];
  return (
    <div className="chart" style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img"
        aria-label={`${ui('exams_chart')} : ${exams.map((e) => e.correct).join(', ')}`}>
        {[0, 10, 20, 30, 40].map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--line)' }} strokeWidth="1" />
            <text x={P.l - 8} y={y(v) + 4} textAnchor="end" fontSize="12" style={{ fill: 'var(--ink-3)' }}>{v}</text>
          </g>
        ))}
        <line x1={P.l} x2={W - P.r} y1={y(EXAM.pass)} y2={y(EXAM.pass)} style={{ stroke: 'var(--ok)' }} strokeWidth="1.5" />
        <text x={W - P.r + 6} y={y(EXAM.pass) + 4} fontSize="12" style={{ fill: 'var(--ink-2)' }}>{EXAM.pass} ✓</text>
        {hover != null && <line x1={pts[hover][0]} x2={pts[hover][0]} y1={P.t} y2={H - P.b} style={{ stroke: 'var(--line-2)' }} strokeWidth="1" />}
        <path d={`${path} L${pts[n - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z`} style={{ fill: 'var(--stamp)' }} opacity="0.08" />
        <path d={path} fill="none" style={{ stroke: 'var(--stamp)' }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <circle key={exams[i].id} cx={p[0]} cy={p[1]} r={hover === i ? 6.5 : 5} style={{ fill: 'var(--stamp)', stroke: 'var(--card)' }} strokeWidth="2" />
        ))}
        <text x={pts[n - 1][0] + 10} y={pts[n - 1][1] - 8} fontSize="13" fontWeight="600" style={{ fill: 'var(--ink)' }}>{last.correct}/40</text>
        {exams.map((e, i) => (n <= 12 || i % Math.ceil(n / 12) === 0) && (
          <text key={e.id} x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" style={{ fill: 'var(--ink-3)' }}>{fmtDate(e.end, uiIdx)}</text>
        ))}
      </svg>
      {hover != null && (
        <div style={{ position: 'absolute', left: `${(pts[hover][0] / W) * 100}%`, top: 0, transform: 'translate(-50%, -100%)', background: 'var(--ink)', color: 'var(--on-fill)', padding: '6px 10px', borderRadius: 10, fontSize: '0.85rem', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {fmtDate(exams[hover].end, uiIdx, true)} · <b>{exams[hover].correct}/40</b> · {ui('mode_' + exams[hover].mode)}{exams[hover].level && <> · {ui('lvl_' + exams[hover].level)}</>}
        </div>
      )}
    </div>
  );
}

// Calendar of the last 13 weeks (intensity = number of answers that day).
function Calendar({ days, uiIdx, ui }) {
  const weeks = 13;
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - (weeks * 7 - 1));
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // aligned on a Monday
  const cells = [];
  const d = new Date(start);
  const tk = todayKey();
  while (d <= today) {
    const k = todayKey(d);
    const n = days[k]?.answered || 0;
    const lvl = n === 0 ? '' : n < 10 ? 'l1' : n < 30 ? 'l2' : 'l3';
    cells.push(<span key={k} className={`${lvl} ${k === tk ? 'today' : ''}`}
      title={`${d.toLocaleDateString(uiIdx ? helpInfo().locale : 'fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} : ${n} ${ui('questions_word')}`} />);
    d.setDate(d.getDate() + 1);
  }
  return (
    <div>
      <div className="cal" role="img" aria-label={ui('calendar')}>{cells}</div>
      <div className="cal-legend">0 <span style={{ background: 'var(--paper)', border: '1px solid var(--line)' }} /><span style={{ background: 'var(--cal-1)' }} /><span style={{ background: 'var(--cal-2)' }} /><span style={{ background: 'var(--stamp)' }} /> 30+</div>
    </div>
  );
}
