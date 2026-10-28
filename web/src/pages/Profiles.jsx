import { CocoAvatar } from '../components/common.jsx';
import { useStore, streakDays } from '../lib/store.js';
import { UI } from '../data/i18n.js';

const lastActive = (p) => Math.max(p.profile.createdAt || 0, ...p.sessions.map((s) => s.end || 0));

// 'Who is studying?': profile choice at launch when there are several.
export default function Profiles({ onAdd }) {
  const { root, openProfile } = useStore();
  const list = Object.entries(root.profiles).sort((a, b) => lastActive(b[1]) - lastActive(a[1]));
  return (
    <div className="setup">
      <div className="setup-card">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <CocoAvatar size={64} />
          <h1>{UI.who[1]}<span className="sub-tr" style={{ color: 'var(--ink-3)' }}>{UI.who[0]}</span></h1>
        </div>
        <div className="profile-list">
          {list.map(([id, p]) => (
            <button type="button" key={id} className="profile-btn" onClick={() => openProfile(id)}>
              <span className="profile-initial" aria-hidden="true">{(p.profile.name || '?').trim().charAt(0).toUpperCase()}</span>
              <span>
                <b>{p.profile.name}</b><br />
                <span className="muted small">⭐ {p.xp} · 🔥 {streakDays(p.days)}</span>
              </span>
            </button>
          ))}
        </div>
        <button type="button" className="btn" style={{ justifySelf: 'start' }} onClick={onAdd}>+ {UI.profile_add[1]} · {UI.profile_add[0]}</button>
      </div>
    </div>
  );
}
