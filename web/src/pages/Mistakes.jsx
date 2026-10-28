import { Tx, U, useLang } from '../components/common.jsx';
import { useStore } from '../lib/store.js';
import { QUESTIONS, isWeak, qStat } from '../lib/quiz.js';
import { THEME_BY_ID } from '../data/themes.js';

export default function Mistakes({ start, askAbout }) {
  const { state } = useStore();
  const { ui } = useLang();
  const list = QUESTIONS.filter((q) => isWeak(qStat(state, q.id)))
    .sort((a, b) => qStat(state, b.id).ko - qStat(state, a.id).ko);

  return (
    <div className="page">
      <div className="hello">
        <div>
          <h1><U k="mistakes_title" dual /></h1>
          <p className="muted" style={{ maxWidth: 640 }}>{ui('mistakes_desc')}</p>
        </div>
        {list.length > 0 && <button type="button" className="btn primary" onClick={() => start('mistakes')}>🔁 <U k="review_mistakes" /> ({Math.min(15, list.length)})</button>}
      </div>
      {list.length === 0 ? (
        <div className="panel empty">
          <span style={{ fontSize: '2.4rem' }}>🌤️</span>
          <p>{ui('mistakes_empty')}</p>
          <button type="button" className="btn primary" onClick={() => start('daily')}>▶ <U k="continue_daily" /></button>
        </div>
      ) : (
        <section className="panel">
          {list.map((q) => {
            const s = qStat(state, q.id);
            return (
              <div className="review-item" key={q.id}>
                <div className="review-q">
                  <span>{THEME_BY_ID[q.t]?.icon}</span>
                  <span style={{ flex: 1 }}><Tx v={q.q} /></span>
                  <span className="tag fail">{ui('missed_times')} {s.ko} {ui('times')}</span>
                </div>
                <div className="review-ans">
                  <div className="ans-ok">✓ <Tx v={q.o[0]} /></div>
                  {askAbout && <div><button type="button" className="btn small ghost" onClick={() => askAbout({ id: q.id, order: [0, 1, 2, 3], chosen: null })}>🐓 <U k="ask_coco" /></button></div>}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
