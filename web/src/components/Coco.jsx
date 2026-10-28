import { useEffect, useRef, useState } from 'react';
import { CocoAvatar, U, useLang, fmtDate } from './common.jsx';
import { useStore } from '../lib/store.js';
import { chatStream, questionContext, speedLevel, systemPrompt } from '../lib/ai.js';
import { helpInfo } from '../lang/langs.js';
import { speak, stopSpeaking } from '../lib/tts.js';
import { Q_BY_ID } from '../lib/quiz.js';
import { UI } from '../data/i18n.js';

// Small safe Markdown renderer (bold, italic, lists, paragraphs).
function renderMd(text) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<i>$2</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  const blocks = text.trim().split(/\n{2,}/);
  return blocks.map((b) => {
    const lines = b.split('\n');
    if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
      const ordered = /^\s*\d/.test(lines[0]);
      const items = lines.map((l) => `<li>${inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ''))}</li>`).join('');
      return ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
    }
    if (/^#{1,4}\s/.test(lines[0])) lines[0] = `<b>${lines[0].replace(/^#{1,4}\s/, '')}</b>`;
    return `<p>${lines.map((l, i) => (i === 0 && l.startsWith('<b>') ? l : inline(l))).join('<br>')}</p>`;
  }).join('');
}

export default function Coco({ ctx, ai, model, messages, setMessages, pendingAsk, clearAsk, onClose, go }) {
  const { state, setState } = useStore();
  const slow = speedLevel(state.settings.aiSpeed?.model === model ? state.settings.aiSpeed.tps : null) === 'slow';
  const { ui, mode, uiIdx } = useLang();
  const [showHistory, setShowHistory] = useState(false);
  const newChat = () => { abortRef.current?.abort(); setState((s) => ({ ...s, chatId: null })); setMessages([]); setShowHistory(false); };
  const openChat = (c) => { abortRef.current?.abort(); setState((s) => ({ ...s, chatId: c.id })); setMessages(c.messages); setShowHistory(false); };
  const deleteChat = (c) => {
    if (!window.confirm(ui('coco_delete_confirm'))) return;
    if (c.id === state.chatId) setMessages([]);
    setState((s) => ({ ...s, chats: s.chats.filter((x) => x.id !== c.id), chatId: s.chatId === c.id ? null : s.chatId }));
  };
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef(null);
  const listRef = useRef(null);
  const ready = ai.status.running && !!model;
  const ctxQ = ctx && ctx.id ? Q_BY_ID[ctx.id] : null;

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

  const send = async (text) => {
    const content = text.trim();
    if (!content || busy) return;
    if (!ready) {
      setMessages((m) => [...m, { role: 'user', content }, { role: 'assistant', content: ui('coco_offline'), error: true }]);
      return;
    }
    const history = [...messages.filter((m) => !m.error), { role: 'user', content }];
    setMessages([...history, { role: 'assistant', content: '', pending: true }]);
    setInput('');
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    const sys = [{ role: 'system', content: systemPrompt({ name: state.profile.name, mode }) }];
    const ctxText = ctx?.exam ? "Elle passe un examen blanc : ne l'aide pas à répondre aux questions de l'examen en cours." : questionContext(ctx);
    const recent = history.slice(-12).map(({ role, content: c }) => ({ role, content: c }));
    if (ctxText) recent.splice(recent.length - 1, 0, { role: 'system', content: ctxText });
    try {
      const full = await chatStream({
        model, messages: [...sys, ...recent], signal: ac.signal,
        onSpeed: (tps) => tps && setState((s) => ({ ...s, settings: { ...s.settings, aiSpeed: { model, tps: Math.round(tps * 10) / 10 } } })),
        onToken: (t) => setMessages((m) => { const c = m.slice(); c[c.length - 1] = { role: 'assistant', content: t, pending: true }; return c; }),
      });
      setMessages((m) => { const c = m.slice(); c[c.length - 1] = { role: 'assistant', content: full || '…' }; return c; });
    } catch (e) {
      const aborted = e.name === 'AbortError';
      setMessages((m) => {
        const c = m.slice();
        const last = c[c.length - 1];
        c[c.length - 1] = aborted ? { role: 'assistant', content: (last.content || '') + ' …' } : { role: 'assistant', content: `${ui('coco_offline')} (${e.message})`, error: true };
        return c;
      });
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  // Quick question asked from the screen (e.g. 'Ask Coco')
  useEffect(() => {
    if (!pendingAsk) return;
    send(ui(pendingAsk));
    clearAsk();
  }, [pendingAsk]); // eslint-disable-line react-hooks/exhaustive-deps

  const quick = ctxQ
    ? (ctx.chosen == null ? ['qp_hint', 'qp_words', 'qp_context'] : ['qp_why', 'qp_words', 'qp_context'])
    : ['qp_quiz'];

  return (
    <aside className="coco" aria-label={ui('coco_title')}>
      <div className="coco-head">
        <CocoAvatar size={38} />
        <h3><U k="coco_title" /></h3>
        <button type="button" className="icon-btn" title={ui('coco_history')} aria-label={ui('coco_history')} aria-pressed={showHistory}
          onClick={() => setShowHistory((v) => !v)}>🕘</button>
        <button type="button" className="icon-btn" title={ui('coco_clear')} aria-label={ui('coco_clear')} onClick={newChat}>✏️</button>
        <button type="button" className="icon-btn" aria-label="Fermer" onClick={onClose}>✕</button>
      </div>
      {!ready && (
        <div className="coco-ctx" style={{ background: 'var(--ko-soft)', color: 'var(--ko)' }}>
          ⚠ {ai.status.running ? ui('ai_no_model') : ui('ai_no_ollama')}
          <button type="button" className="btn small" style={{ marginLeft: 'auto' }} onClick={() => go('settings')}>⚙</button>
        </div>
      )}
      {ready && slow && <div className="coco-ctx" style={{ background: 'var(--sun-soft)', color: 'var(--sun-ink)' }}>🐢 {ui('ai_slow_hint')}</div>}
      {ctxQ && <div className="coco-ctx">👁 {ui('coco_context')} : « {ctxQ.q[mode === 'tr' ? 1 : 0].slice(0, 60)}{ctxQ.q[0].length > 60 ? '…' : ''} »</div>}
      {ctx?.exam && <div className="coco-ctx" style={{ background: 'var(--sun-soft)', color: 'var(--sun-ink)' }}>📝 {ui('exam_mode_note')}</div>}

      {showHistory ? (
        <div className="coco-history">
          <div className="coco-history-head">
            <b>{ui('coco_history')}</b>
            <button type="button" className="btn small" onClick={() => setShowHistory(false)}>← {ui('coco_back')}</button>
          </div>
          {state.chats.length === 0 && <p className="muted small">{ui('coco_history_empty')}</p>}
          {state.chats.slice().reverse().map((c) => (
            <div key={c.id} className={`chat-item ${c.id === state.chatId ? 'current' : ''}`}>
              <button type="button" className="chat-open" onClick={() => openChat(c)}>
                <span className="chat-title">{c.title}</span>
                <span className="muted small">{fmtDate(c.updated, uiIdx, true)} · {c.messages.length} {ui('coco_msgs')}</span>
              </button>
              <button type="button" className="icon-btn" title={ui('coco_delete_chat')} aria-label={ui('coco_delete_chat')} onClick={() => deleteChat(c)}>🗑</button>
            </div>
          ))}
        </div>
      ) : (<>
      <div className="coco-msgs" ref={listRef} aria-live="polite">
        {messages.length === 0 && (
          <div className="msg-row"><div className="msg bot">{ui('coco_hello')}</div></div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="msg-row" style={{ justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'user' ? <div className="msg me" dir="auto">{m.content}</div> : (
              <div className={`msg bot ${m.error ? 'err' : ''}`} dir="auto">
                {m.pending && !m.content ? <span className="typing"><i /><i /><i /></span>
                  : <div dangerouslySetInnerHTML={{ __html: renderMd(m.content) }} />}
                {!m.pending && !m.error && m.content && (
                  <div className="msg-tools">
                    <button type="button" onClick={() => speak(m.content.replace(/[*#`]/g, ''), { lang: mode === 'fr' ? 'fr-FR' : helpInfo().locale, rate: state.settings.ttsRate })}>🔊</button>
                    <button type="button" onClick={stopSpeaking}>⏹</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="quick">
        {quick.map((k) => <button type="button" key={k} onClick={() => send(ui(k))} disabled={busy}>{ui(k)}{mode === 'bi' && <span className="sub-tr">{UI[k][1]}</span>}</button>)}
      </div>
      <form className="coco-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <textarea rows={2} value={input} placeholder={mode === 'bi' ? `${UI.coco_placeholder[0]} / ${UI.coco_placeholder[1]}` : ui('coco_placeholder')} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }} />
        {busy
          ? <button type="button" className="btn small" onClick={() => abortRef.current?.abort()}>⏹</button>
          : <button type="submit" className="btn small primary" disabled={!input.trim()}>➤</button>}
      </form>
      </>)}
    </aside>
  );
}
