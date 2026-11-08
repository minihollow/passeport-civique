import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UI } from '../data/i18n.js';
import { useStore } from '../lib/store.js';
import { speak } from '../lib/tts.js';
import { tokenize, wordKey } from '../lib/words.js';
import { helpLang, helpInfo, wordTr } from '../lang/langs.js';

// Interface language: the help language in 'tr' mode, French otherwise.
// help: help language code (lang attribute); helpTag: short label of the translate buttons.
export function useLang() {
  const { state } = useStore();
  const mode = state.settings.mode;
  const uiIdx = mode === 'tr' ? 1 : 0;
  const ui = (k) => (UI[k] ? UI[k][uiIdx] : k);
  const pick = (pair) => (Array.isArray(pair) ? pair[uiIdx] : pair);
  return { mode, uiIdx, ui, pick, help: helpLang(), helpTag: helpLang().toUpperCase(), showAllTr: state.settings.showAllTr, rate: state.settings.ttsRate };
}

// Interface label. In bilingual mode, `dual` adds the translation in small print.
export function U({ k, dual = false }) {
  const { mode, ui } = useLang();
  if (mode === 'bi' && dual && UI[k]) {
    return (<>{UI[k][0]}<span className="sub-tr">{UI[k][1]}</span></>);
  }
  return ui(k);
}

// Bilingual content [fr, help] depending on the mode.
// - tr: help language only; fr: French only; bi: French, click to see the translation.
export function Tx({ v, block = false, revealed, onToggle }) {
  const { mode, showAllTr } = useLang();
  const [open, setOpen] = useState(false);
  if (!v) return null;
  if (mode === 'tr') return <span lang={helpLang()} dir="auto">{v[1]}</span>;
  if (mode === 'fr') return <span lang="fr">{v[0]}</span>;
  const isOpen = revealed ?? (open || showAllTr);
  const toggle = (e) => { e.stopPropagation(); onToggle ? onToggle() : setOpen((o) => !o); };
  return (
    <>
      <span lang="fr" className="fr-clickable" role="button" tabIndex={0} title={UI.tap_translate[1]}
        onClick={toggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); } }}>
        {v[0]}
      </span>
      {isOpen && (block ? <span className="tr-line" lang={helpLang()} dir="auto" style={{ display: 'block' }}>{v[1]}</span>
        : <span className="tr-line" lang={helpLang()} dir="auto"> {v[1]}</span>)}
    </>
  );
}

// French text where each word can be tapped: reads the word aloud and shows its translation
// (help language glossary). Clicks stop here, so a word inside a choice does not pick the choice.
// focusable: false inside a button (keyboard users reach the whole choice instead).
let closeOpenWord = null; // one word bubble open at a time, in the whole app
export function Words({ text, focusable = true }) {
  const { rate } = useLang();
  const [open, setOpen] = useState(null); // { i, x, y }
  const bubble = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(null);
    closeOpenWord = close;
    const onDown = (e) => { if (!bubble.current?.contains(e.target) && !e.target.closest?.('.word')) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      if (closeOpenWord === close) closeOpenWord = null;
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);
  if (!text) return null;
  const tokens = tokenize(text);
  const tap = (e, i, word) => {
    e.stopPropagation();
    e.preventDefault();
    speak(word, { rate });
    if (open?.i === i) return; // same word again: just read it again
    closeOpenWord?.();
    const r = e.currentTarget.getBoundingClientRect();
    setOpen({ i, x: Math.max(8, Math.min(r.left, window.innerWidth - 268)), y: r.bottom + 6 });
  };
  const cur = open && tokens[open.i];
  const tr = cur ? wordTr(wordKey(cur.text)) : '';
  return (
    <>
      {tokens.map((t, i) => (t.word ? (
        <span key={i} className={`word${open?.i === i ? ' on' : ''}`} lang="fr"
          role={focusable ? 'button' : undefined} tabIndex={focusable ? 0 : undefined}
          onClick={(e) => tap(e, i, t.text)}
          onKeyDown={focusable ? (e) => { if (e.key === 'Enter' || e.key === ' ') tap(e, i, t.text); } : undefined}>
          {t.text}
        </span>
      ) : <span key={i}>{t.text}</span>))}
      {cur && createPortal(
        <span ref={bubble} className="word-pop" role="dialog" style={{ left: open.x, top: open.y }}
          onClick={(e) => e.stopPropagation()}>
          <span className="word-pop-head">
            <b lang="fr">{cur.text}</b>
            <button type="button" className="icon-btn" aria-label={`${UI.listen?.[0] || 'Écouter'} ${cur.text}`}
              onClick={() => speak(cur.text, { rate })}>🔊</button>
          </span>
          {tr && <span className="tr-line" lang={helpLang()} dir="auto">{tr}</span>}
        </span>,
        document.body,
      )}
    </>
  );
}

export function SpeakBtn({ text, lang = 'fr-FR', label, style }) {
  const { rate } = useLang();
  if (!text) return null;
  return (
    <button type="button" className="icon-btn" style={style} title={label || 'Écouter / Dinle'} aria-label={label || 'Écouter'}
      onClick={(e) => { e.stopPropagation(); speak(text, { lang, rate }); }}>
      🔊
    </button>
  );
}

// Drawn flags (Windows does not show flag emojis).
export function Flag({ c, h = 14 }) {
  const w = Math.round(h * 1.5);
  const id = useId().replace(/:/g, '');
  if (c === 'gb') {
    // Union Jack (drawn 2:1, shown in the same 3:2 box as the other flags)
    return (
      <svg width={w} height={h} viewBox="0 0 60 30" preserveAspectRatio="none" aria-hidden="true" style={{ borderRadius: 3, flex: 'none' }}>
        <clipPath id={`${id}s`}><path d="M0,0 v30 h60 v-30 z" /></clipPath>
        <clipPath id={`${id}t`}><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" /></clipPath>
        <g clipPath={`url(#${id}s)`}>
          <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
          <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${id}t)`} stroke="#C8102E" strokeWidth="4" />
          <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
          <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
        </g>
      </svg>
    );
  }
  if (c === 'fr') {
    return (
      <svg width={w} height={h} viewBox="0 0 3 2" aria-hidden="true" style={{ borderRadius: 3, boxShadow: '0 0 0 1px rgba(25,35,77,.15)', flex: 'none' }}>
        <rect width="1" height="2" fill="#002395" /><rect x="1" width="1" height="2" fill="#fff" /><rect x="2" width="1" height="2" fill="#ED2939" />
      </svg>
    );
  }
  const star = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? 0.5 : 1.25;
    const a = (Math.PI / 5) * i;
    return `${(16.6 + r * Math.cos(a)).toFixed(2)},${(10 + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox="0 0 30 20" aria-hidden="true" style={{ borderRadius: 3, flex: 'none' }}>
      <rect width="30" height="20" fill="#E30A17" />
      <circle cx="11" cy="10" r="5" fill="#fff" />
      <circle cx="12.25" cy="10" r="4" fill="#E30A17" />
      <polygon points={star} fill="#fff" />
    </svg>
  );
}

// Help language flag if there is one, otherwise its code (EN, AR…).
function HelpFlag({ h }) {
  const info = helpInfo();
  if (info.flag) return <Flag c={info.flag} h={h} />;
  return <span className="lang-code" style={{ fontSize: h * 0.7 }}>{helpLang().toUpperCase()}</span>;
}
export function ModeFlag({ mode, h = 14 }) {
  if (mode === 'bi') return <span style={{ display: 'inline-flex', gap: 2 }}><Flag c="fr" h={h} /><HelpFlag h={h} /></span>;
  return mode === 'fr' ? <Flag c="fr" h={h} /> : <HelpFlag h={h} />;
}

export function CocoAvatar({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="34" r="26" fill="#fff" stroke="#19234d" strokeWidth="3" />
      <path d="M20 12c2-6 8-6 9 0 2-7 9-7 10 0 3-5 9-3 8 3-1 4-4 6-6 7H22c-3-2-4-6-2-10z" fill="#d23c3c" stroke="#19234d" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="24" cy="33" r="3.6" fill="#19234d" />
      <circle cx="25.2" cy="31.8" r="1.1" fill="#fff" />
      <circle cx="40" cy="33" r="3.6" fill="#19234d" />
      <circle cx="41.2" cy="31.8" r="1.1" fill="#fff" />
      <path d="M27 40l5-3 5 3-5 6z" fill="#f2ad1f" stroke="#19234d" strokeWidth="2" strokeLinejoin="round" />
      <path d="M31 46c-1 4 1 7 4 7s4-4 1-7" fill="#d23c3c" stroke="#19234d" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

let stampSeq = 0;
// Round rubber stamp (text on top, icon in the centre, date at the bottom).
export function Stamp({ top, center, small, bottom, color = 'var(--stamp)', size = 108, rotate = -10, className = '', dim = false }) {
  const [id] = useState(() => `st${++stampSeq}`);
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 120 120"
      style={{ transform: `rotate(${rotate}deg)`, opacity: dim ? 0.18 : 0.92 }} role="img" aria-label={[top, small, bottom].filter(Boolean).join(' – ')}>
      <defs>
        <filter id={`${id}f`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={stampSeq % 7} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" />
        </filter>
        <path id={`${id}t`} d="M 22 60 A 38 38 0 0 1 98 60" />
        <path id={`${id}b`} d="M 15 60 A 45 45 0 0 0 105 60" />
      </defs>
      <g filter={`url(#${id}f)`} style={{ fill: color, stroke: color }}>
        <circle cx="60" cy="60" r="55" fill="none" strokeWidth="3.2" />
        <circle cx="60" cy="60" r="47.5" fill="none" strokeWidth="1.3" />
        <text fontSize="10.5" fontWeight="700" letterSpacing="1.2" stroke="none">
          <textPath href={`#${id}t`} startOffset="50%" textAnchor="middle">{top}</textPath>
        </text>
        {center && <text x="60" y={small ? 64 : 70} fontSize={String(center).length > 3 ? 18 : 26} textAnchor="middle" stroke="none">{center}</text>}
        {small && <text x="60" y="84" fontSize="11" fontWeight="700" textAnchor="middle" stroke="none">{small}</text>}
        {bottom && (
          <text fontSize="9" fontWeight="600" letterSpacing="1" stroke="none">
            <textPath href={`#${id}b`} startOffset="50%" textAnchor="middle">{bottom}</textPath>
          </text>
        )}
      </g>
    </svg>
  );
}

export function Meter({ value, color }) {
  return <div className="meter"><span style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, background: color }} /></div>;
}

export function fmtDate(ts, uiIdx, withTime = false) {
  const d = new Date(ts);
  const loc = uiIdx === 1 ? helpInfo().locale : 'fr-FR';
  return d.toLocaleDateString(loc, { day: 'numeric', month: 'short', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) });
}
