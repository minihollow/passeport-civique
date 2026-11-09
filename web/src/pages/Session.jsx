import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QuestionCard from '../components/QuestionCard.jsx';
import { U, useLang } from '../components/common.jsx';
import { useStore } from '../lib/store.js';
import { EXAM_LEVELS, Q_BY_ID, applyAnswer, awardBadges, isRight } from '../lib/quiz.js';
import { EXAM } from '../data/themes.js';
import { stopSpeaking } from '../lib/tts.js';

// Runs a series (immediate correction) or a mock exam (correction at the end).
export default function Session({ plan, go, restart, setCoco, askCoco, notify }) {
  const { state, setState } = useStore();
  const { ui } = useLang();
  const isExam = plan.type === 'exam';
  // Resume: start again from the question and answers saved in plan.
  const [idx, setIdx] = useState(plan.idx || 0);
  const [answers, setAnswers] = useState(plan.answers || {}); // id -> choice (original index)
  const startedAt = plan.startedAt || plan.key;
  const [now, setNow] = useState(Date.now());
  const finished = useRef(false);
  // Phones: the exam question grid is one scrolling row; keep the current question in view.
  const gridRef = useRef(null);
  useEffect(() => {
    gridRef.current?.querySelector('.cur')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [idx]);
  const items = plan.items;
  const cur = items[idx];
  const q = Q_BY_ID[cur.id];
  const chosen = answers[cur.id];

  // Context for Coco (not during the exam, as on exam day).
  useEffect(() => {
    setCoco(isExam ? { exam: true } : { id: cur.id, order: cur.order, chosen: chosen ?? null });
  }, [cur.id, chosen, isExam]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { setCoco(null); stopSpeaking(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save progress in the current series.
  useEffect(() => {
    setState((s) => (s.current?.key === plan.key ? { ...s, current: { ...s.current, idx, answers } } : s));
  }, [idx, answers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Exam timer (keeps running when leaving the page, as on exam day)
  const deadline = startedAt + EXAM.minutes * 60000;
  useEffect(() => {
    if (!isExam) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isExam]);
  const remaining = Math.max(0, deadline - now);

  const finish = useCallback((finalAnswers) => {
    if (finished.current) return;
    finished.current = true;
    const ans = finalAnswers || answers;
    const end = Date.now();
    let s = state;
    const list = items.filter((it) => isExam || ans[it.id] != null).map((it) => {
      const c = ans[it.id];
      const ok = c != null && isRight(Q_BY_ID[it.id], c);
      if (isExam && c != null) s = applyAnswer(s, it.id, ok);
      if (isExam && c == null) s = applyAnswer(s, it.id, false);
      return { id: it.id, c: c ?? null, ok, order: it.order };
    });
    const correct = list.filter((a) => a.ok).length;
    const record = {
      id: end, type: plan.type, mode: state.settings.mode, theme: plan.theme || null, sub: plan.sub || null, level: plan.level || null,
      start: startedAt, end, total: list.length, correct,
      passed: isExam ? correct >= EXAM.pass : undefined,
      answers: list,
    };
    if (isExam) { s = { ...s, xp: s.xp + (record.passed ? 100 : 20) }; }
    s = { ...s, sessions: [...s.sessions, record], current: null };
    const { state: withBadges, fresh } = awardBadges(s);
    setState(withBadges);
    stopSpeaking();
    go('result', { sessionId: record.id, freshBadges: fresh.map((b) => b.id) });
  }, [answers, items, isExam, plan, setState, startedAt, state, go]);

  // Exam time is up
  useEffect(() => { if (isExam && remaining <= 0 && !finished.current) finish(); }, [isExam, remaining, finish]);

  const choose = useCallback((oi) => {
    if (isExam) {
      setAnswers((a) => ({ ...a, [cur.id]: oi }));
      return;
    }
    if (answers[cur.id] != null) return;
    setAnswers((a) => ({ ...a, [cur.id]: oi }));
    setState((s) => applyAnswer(s, cur.id, isRight(q, oi)));
  }, [isExam, cur.id, q, answers, setState]);

  const next = useCallback(() => {
    stopSpeaking();
    if (idx < items.length - 1) setIdx(idx + 1);
    else if (!isExam) finish();
  }, [idx, items.length, isExam, finish]);

  // Enter = next (in practice, after answering)
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('textarea, input')) return;
      if (e.key === 'Enter' && (isExam || chosen != null)) { e.preventDefault(); next(); }
      if (isExam && e.key === 'ArrowLeft' && idx > 0) setIdx(idx - 1);
      if (isExam && e.key === 'ArrowRight' && idx < items.length - 1) setIdx(idx + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, chosen, isExam, idx, items.length]);

  const answeredCount = Object.keys(answers).length;
  const progress = isExam ? answeredCount / items.length : (idx + (chosen != null ? 1 : 0)) / items.length;

  const quit = () => {
    if (window.confirm(ui('quit_confirm'))) {
      if (isExam || answeredCount === 0) { stopSpeaking(); setState((s) => ({ ...s, current: null })); go('home'); } else finish();
    }
  };

  const endExam = () => {
    const missing = items.length - answeredCount;
    if (missing > 0 && !window.confirm(`${missing} ${ui('unanswered_warn')}`)) return;
    finish();
  };

  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);

  return (
    <div className="session">
      <div className="session-top">
        <button type="button" className="icon-btn" onClick={quit} aria-label={ui('quit')} title={ui('quit')}>✕</button>
        <div className="progress-track" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${progress * 100}%` }} />
        </div>
        {isExam && (
          <select className="pill level-pick" value={plan.level || 'real'} aria-label={ui('exam_level')} title={ui('lvl_' + (plan.level || 'real') + '_desc')}
            onChange={(e) => { if (window.confirm(`${ui('level_restart')} ${ui('lvl_' + e.target.value)}`)) restart({ level: e.target.value }); }}>
            {EXAM_LEVELS.map((l) => <option key={l} value={l}>{ui('lvl_' + l)}</option>)}
          </select>
        )}
        {isExam && (
          <span className={`pill timer ${remaining < 5 * 60000 ? 'low' : ''}`} title={ui('time_left')}>
            ⏱ {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
          </span>
        )}
        <ShowAllTr />
      </div>

      <QuestionCard
        q={q} order={cur.order} chosen={chosen} onChoose={choose} reveal={!isExam}
        index={idx} total={items.length}
        onAsk={!isExam && askCoco ? () => askCoco('why') : undefined}
      />

      {isExam ? (
        <div className="session-bottom">
          <div className="session-foot">
            <button type="button" className="btn" onClick={() => setIdx(idx - 1)} disabled={idx === 0}>← <U k="prev" /></button>
            <span className="muted small" style={{ textAlign: 'center' }}>{answeredCount} / {items.length} <U k="answered" /><span className="exam-note"><br />📝 <U k="exam_mode_note" /></span></span>
            {idx < items.length - 1
              ? <button type="button" className="btn primary" onClick={next}><U k="next" /></button>
              : <button type="button" className="btn primary" onClick={endExam}><U k="finish" /></button>}
          </div>
          <div className="exam-grid" aria-label="Questions" ref={gridRef}>
            {items.map((it, i) => (
              <button key={it.id} type="button" className={`${answers[it.id] != null ? 'done' : ''} ${i === idx ? 'cur' : ''}`}
                onClick={() => setIdx(i)} aria-label={`${ui('question')} ${i + 1}`}>{i + 1}</button>
            ))}
            <button type="button" className="btn small ink" style={{ width: 'auto', height: 30, padding: '0 12px', marginLeft: 8 }} onClick={endExam}><U k="finish" /></button>
          </div>
        </div>
      ) : (
        <div className="session-bottom">
          <div className="session-foot">
            <span className="muted small">{chosen == null ? '1 – 4 / A – D' : `⏎ ${ui('key_enter')}`}</span>
            <button type="button" className="btn primary" onClick={next} disabled={chosen == null}>
              {idx < items.length - 1 ? <U k="next" /> : <U k="finish" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ShowAllTr() {
  const { state, setState } = useStore();
  const { ui } = useLang();
  if (state.settings.mode !== 'bi') return null;
  const on = state.settings.showAllTr;
  return (
    <button type="button" className="icon-btn tr-btn" style={{ height: 36 }} aria-pressed={on}
      onClick={() => setState((s) => ({ ...s, settings: { ...s.settings, showAllTr: !on } }))}>
      TR · {ui('translate_all')}
    </button>
  );
}

export function useSessionStats(session) {
  return useMemo(() => {
    if (!session) return null;
    const byTheme = {};
    for (const a of session.answers) {
      const q = Q_BY_ID[a.id];
      if (!q) continue;
      byTheme[q.t] = byTheme[q.t] || { n: 0, ok: 0 };
      byTheme[q.t].n += 1;
      if (a.ok) byTheme[q.t].ok += 1;
    }
    return { byTheme };
  }, [session]);
}
