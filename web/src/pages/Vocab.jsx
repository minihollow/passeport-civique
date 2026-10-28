import { useMemo, useState } from 'react';
import { U, useLang, SpeakBtn } from '../components/common.jsx';
import { QUESTIONS, shuffle } from '../lib/quiz.js';
import { THEMES } from '../data/themes.js';
import { helpLang } from '../lang/langs.js';

const ALL = (() => {
  const seen = new Map();
  for (const q of QUESTIONS) {
    for (const [fr, tr] of q.v || []) {
      const key = fr.toLowerCase();
      if (!seen.has(key)) seen.set(key, { fr, tr, t: q.t });
    }
  }
  return [...seen.values()].sort((a, b) => a.fr.localeCompare(b.fr, 'fr', { sensitivity: 'base' }));
})();

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^(le |la |les |l'|un |une |des )/, '');

export default function Vocab() {
  const { ui, pick } = useLang();
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState('');
  const [cards, setCards] = useState(false);
  const list = useMemo(() => ALL.filter((w) => (!theme || w.t === theme)
    && (!query || norm(w.fr).includes(norm(query)) || w.tr.toLowerCase().includes(query.toLowerCase()))), [query, theme]);

  return (
    <div className="page">
      <div className="hello">
        <div>
          <h1><U k="vocab_title" dual /></h1>
          <p className="muted">{ui('vocab_desc')} {list.length} {ui('vocab_count')}.</p>
        </div>
        <div className="modes" role="group">
          <button type="button" aria-pressed={!cards} onClick={() => setCards(false)}>☰ {ui('vocab_list')}</button>
          <button type="button" aria-pressed={cards} onClick={() => setCards(true)}>🃏 {ui('vocab_cards')}</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 320 }} placeholder={ui('vocab_search')} value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input" style={{ maxWidth: 320 }} value={theme} onChange={(e) => setTheme(e.target.value)}>
          <option value="">— {ui('themes')} —</option>
          {THEMES.map((t) => <option key={t.id} value={t.id}>{t.icon} {pick(t.name)}</option>)}
        </select>
      </div>
      {cards ? <Flashcards key={`${query}|${theme}`} words={list} /> : (
        <div className="vocab-grid">
          {list.map((w) => (
            <div className="vocab-item" key={w.fr}>
              <SpeakBtn text={w.fr} />
              <div><div className="fr" lang="fr">{w.fr}</div><div className="tr" lang={helpLang()} dir="auto">{w.tr}</div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Flashcards({ words }) {
  const { ui } = useLang();
  const [deck, setDeck] = useState(() => shuffle(words));
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  if (!deck.length) return null;
  const w = deck[i % deck.length];
  const next = () => { setFlipped(false); setI((n) => n + 1); };
  return (
    <div className="flash">
      <button type="button" className="flash-card" onClick={() => setFlipped((f) => !f)} aria-label={ui('vocab_flip')}>
        {flipped ? <span className="tr" lang={helpLang()} dir="auto">{w.tr}</span> : <span lang="fr">{w.fr}</span>}
      </button>
      <div style={{ display: 'flex', gap: 10 }}>
        <SpeakBtn text={w.fr} />
        <button type="button" className="btn" onClick={() => setFlipped((f) => !f)}>🔄 {ui('vocab_flip')}</button>
        <button type="button" className="btn primary" onClick={next}>{ui('next')}</button>
        <button type="button" className="btn ghost" onClick={() => { setDeck(shuffle(words)); setI(0); setFlipped(false); }}>🔀</button>
      </div>
      <span className="muted small">{(i % deck.length) + 1} / {deck.length}</span>
    </div>
  );
}
