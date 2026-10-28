import { Stamp, U, useLang, CocoAvatar, Meter } from '../components/common.jsx';
import { useStore, streakDays, todayKey } from '../lib/store.js';
import { BADGES, EXAM_LEVELS, masteryOf, readiness, isWeak, qStat, QUESTIONS } from '../lib/quiz.js';
import { THEMES } from '../data/themes.js';
import { helpInfo } from '../lang/langs.js';

export default function Home({ start, go }) {
  const { state } = useStore();
  const { ui, pick, uiIdx } = useLang();
  const name = state.profile.name;
  const streak = streakDays(state.days);
  const today = state.days[todayKey()] || { answered: 0 };
  const goal = state.settings.dailyGoal || 20;
  const ready = readiness(state);
  const mastery = masteryOf(state);
  const weak = QUESTIONS.filter((q) => isWeak(qStat(state, q.id))).length;
  const earned = BADGES.filter((b) => state.badges[b.id]).sort((a, b) => state.badges[a.id] - state.badges[b.id]);
  const nextOnes = BADGES.filter((b) => !state.badges[b.id]).slice(0, Math.max(0, 6 - earned.length));
  const examDays = state.settings.examDate ? Math.ceil((new Date(state.settings.examDate) - new Date(todayKey())) / 86400000) : null;

  return (
    <div className="page">
      <div className="hello">
        <div>
          <h1>{ui('hello')}{name ? ` ${name}` : ''} 👋</h1>
          <p className="muted">{ui('mode_' + state.settings.mode + '_desc')}</p>
        </div>
        {examDays != null && examDays >= 0 && (
          <span className="pill stamp">📅 {ui('exam_in')} {examDays} {ui('days')}</span>
        )}
      </div>

      <section className="passport" aria-label={ui('appName')}>
        <div className="cover">
          <div className="cover-title">{ui('appName').toLocaleUpperCase(uiIdx ? helpInfo().locale : 'fr-FR')}</div>
          <div className="cover-emblem"><CocoAvatar size={74} /></div>
          <div className="cover-stats">
            <div className="cover-stat">🔥 <b>{streak}</b> {ui(streak === 1 ? 'streak_day' : 'streak_days')}</div>
            <div className="cover-stat">⭐ <b>{state.xp}</b> {ui('xp')}</div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: 6 }}>
                <span title={ui('readiness_hint')}>{ui('readiness')}</span><b style={{ color: '#fff' }}>{ready} %</b>
              </div>
              <div className="ready-bar"><span style={{ width: `${ready}%` }} /></div>
            </div>
          </div>
        </div>
        <div className="visa">
          <div className="visa-head">
            <h2><U k="my_stamps" dual /></h2>
            <span className="muted small">{earned.length} / {BADGES.length}</span>
          </div>
          <div className="stamps">
            {earned.map((b, i) => (
              <div className="stamp-slot" key={b.id} title={pick(b.name)}>
                <Stamp size={104} color={b.color} top={pick(b.short)} center={b.icon}
                  bottom={new Date(state.badges[b.id]).toLocaleDateString(uiIdx ? helpInfo().locale : 'fr-FR')}
                  rotate={[-12, 8, -4, 14, -16, 5][i % 6]} />
              </div>
            ))}
            {nextOnes.map((b) => (
              <div className="stamp-slot" key={b.id} title={pick(b.name)}>
                <Stamp size={96} color="var(--stamp-ink)" top={pick(b.short)} center={b.icon} rotate={0} dim />
              </div>
            ))}
          </div>
          {earned.length === 0 && <p className="muted small"><U k="stamps_empty" /></p>}
        </div>
      </section>

      <section className="actions">
        <button type="button" className="action hero" onClick={() => start('daily')}>
          <span className="big">▶ <U k="continue_daily" /></span>
          <span className="muted">{ui('continue_daily_desc')}</span>
          <div className="goal">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
              <span>{ui('today_goal')}</span><span>{Math.min(today.answered, goal)} / {goal}</span>
            </div>
            <div className="goal-bar"><span style={{ width: `${Math.min(1, today.answered / goal) * 100}%` }} /></div>
          </div>
        </button>
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="action">
            <span className="big">📝 <U k="start_exam" /></span>
            <span className="muted small">{ui('start_exam_desc')}</span>
            <div className="levels">
              {EXAM_LEVELS.map((l) => (
                <button key={l} type="button" className="btn small" title={ui('lvl_' + l + '_desc')} onClick={() => start('exam', { level: l })}>
                  {ui('lvl_' + l)}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="action" onClick={() => go('mistakes')} disabled={!weak} style={{ opacity: weak ? 1 : 0.6 }}>
            <span className="big" style={{ fontSize: '1.05rem' }}>🔁 <U k="review_mistakes" /> {weak > 0 && <span className="pill" style={{ marginLeft: 6 }}>{weak}</span>}</span>
          </button>
        </div>
      </section>

      <section>
        <div className="panel-head">
          <h2><U k="themes" dual /></h2>
          <span className="muted small">{mastery.mastered} / {mastery.total} {ui('mastered')}</span>
        </div>
        <div className="themes">
          {THEMES.map((t) => {
            const m = masteryOf(state, (q) => q.t === t.id);
            return (
              <button type="button" className="theme-row" key={t.id} onClick={() => go('practice', { theme: t.id })}>
                <span className="theme-ico">{t.icon}</span>
                <span>
                  <span style={{ fontWeight: 600 }}>{pick(t.name)}</span>
                  {uiIdx === 0 && state.settings.mode === 'bi' && <span className="sub-tr">{t.name[1]}</span>}
                  <Meter value={m.pct} />
                  <span className="muted small">{m.mastered} / {m.total} {ui('mastered')} · {m.seen} {ui('seen')}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
