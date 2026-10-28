import { useEffect, useState } from 'react';
import { Tx, U, useLang, SpeakBtn } from './common.jsx';
import { THEME_BY_ID, subName } from '../data/themes.js';
import { speak } from '../lib/tts.js';
import { isRight, rightIn } from '../lib/quiz.js';

const LETTERS = ['A', 'B', 'C', 'D'];

// Shows a question and its 4 choices.
// reveal: show the correction (practice); otherwise only the choice is shown (exam).
export default function QuestionCard({ q, order, chosen, onChoose, reveal, index, total, onAsk, children }) {
  const { mode, pick, showAllTr, help, helpTag } = useLang();
  const [trQ, setTrQ] = useState(false);
  const [trOpts, setTrOpts] = useState({});
  useEffect(() => { setTrQ(false); setTrOpts({}); }, [q.id]);

  const theme = THEME_BY_ID[q.t];
  const answered = chosen != null;
  const qOpen = trQ || showAllTr;

  // Keyboard shortcuts: 1-4 or A-D to answer.
  useEffect(() => {
    if (answered && reveal) return undefined;
    const onKey = (e) => {
      if (e.target.closest('textarea, input')) return;
      const k = e.key.toLowerCase();
      const i = ['1', '2', '3', '4'].indexOf(k) >= 0 ? ['1', '2', '3', '4'].indexOf(k) : ['a', 'b', 'c', 'd'].indexOf(k);
      if (i >= 0 && !(answered && reveal)) onChoose(order[i]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [order, answered, reveal, onChoose]);

  return (
    <div className="q-card">
      <div className="q-meta">
        {index != null && <b>{index + 1} / {total}</b>}
        <span className="chip">{theme?.icon} {pick(q.s === 'situation' ? theme.name : subName(q.t, q.s))}</span>
        {q.k === 'situ' && <span className="chip situ">🎭 <U k="situations" /></span>}
      </div>

      <div className="q-text-row">
        <div className="q-text">
          <Tx v={q.q} revealed={qOpen} onToggle={() => setTrQ((o) => !o)} block />
        </div>
        <div className="q-tools">
          {mode !== 'tr' && <SpeakBtn text={q.q[0]} />}
          {mode === 'bi' && (
            <button type="button" className="icon-btn tr-btn" aria-pressed={qOpen} onClick={() => setTrQ((o) => !o)} title={helpTag}>{helpTag}</button>
          )}
        </div>
      </div>

      <div className="options" role="group">
        {order.map((oi, k) => {
          const isChosen = chosen === oi;
          let cls = 'opt';
          if (reveal && answered) {
            if (isRight(q, oi)) cls += ' right';
            else if (isChosen) cls += ' wrong';
            else cls += ' dim';
          } else if (isChosen) cls += ' picked';
          const optOpen = trOpts[oi] || showAllTr;
          return (
            <div className="opt-row" key={oi}>
              <button type="button" className={cls} disabled={reveal && answered} onClick={() => onChoose(oi)} aria-pressed={isChosen}>
                <span className="letter">{LETTERS[k]}</span>
                <span>
                  {mode === 'tr' ? <span lang={help} dir="auto">{q.o[oi][1]}</span> : <span lang="fr">{q.o[oi][0]}</span>}
                  {mode === 'bi' && optOpen && <span className="tr-line" lang={help} dir="auto">{q.o[oi][1]}</span>}
                </span>
              </button>
              {mode === 'bi' && (
                <button type="button" className="icon-btn tr-btn" style={{ height: 'auto' }} aria-pressed={!!optOpen}
                  onClick={() => setTrOpts((s) => ({ ...s, [oi]: !s[oi] }))} title={helpTag}>{helpTag}</button>
              )}
            </div>
          );
        })}
      </div>

      {reveal && answered && <Feedback q={q} ok={isRight(q, chosen)} onAsk={onAsk} order={order} />}
      {children}
    </div>
  );
}

function Feedback({ q, ok, onAsk, order }) {
  const { ui, rate, help } = useLang();
  const right = rightIn(q, order);
  const correctLetter = LETTERS[order.indexOf(right)];
  return (
    <div className={`feedback ${ok ? 'ok' : 'ko'}`} aria-live="polite">
      <div className="feedback-title">{ok ? '✓' : '✗'} <U k={ok ? 'correct' : 'wrong'} /></div>
      {!ok && (
        <div>
          <b><U k="right_answer_was" /></b> {correctLetter}) <Tx v={q.o[right]} />
        </div>
      )}
      <div className="expl"><Tx v={q.x} block /></div>
      {q.v?.length > 0 && (
        <div>
          <div className="small muted" style={{ marginBottom: 6 }}><U k="words" /></div>
          <div className="vocab-chips">
            {q.v.map(([fr, tr]) => (
              <span className="vchip" key={fr}>
                <span className="fr" lang="fr">{fr}</span>
                <span className="tr" lang={help} dir="auto">{tr}</span>
                <button type="button" onClick={() => speak(fr, { rate })} aria-label={`${ui('listen')} ${fr}`}>🔊</button>
              </span>
            ))}
          </div>
        </div>
      )}
      {onAsk && (
        <div>
          <button type="button" className="btn small" onClick={onAsk}>🐓 <U k="ask_coco" /></button>
        </div>
      )}
    </div>
  );
}
