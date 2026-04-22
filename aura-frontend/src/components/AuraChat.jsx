import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send, ShieldAlert, ShieldCheck, ShieldOff, Copy, Check,
  Cpu, Zap, AlertCircle, Network, Info
} from 'lucide-react';

// ── Risk level config ──────────────────────────────────────────────
const RISK_CONFIG = {
  HIGH:   { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: '#ef444440', icon: ShieldAlert,  label: 'HIGH RISK — CRITICAL CHANGES DETECTED',     accent: '#dc2626' },
  MEDIUM: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: '#f59e0b40', icon: ShieldAlert,  label: 'MEDIUM RISK — REVIEW RECOMMENDED',           accent: '#d97706' },
  LOW:    { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  border: '#3b82f640', icon: Info,         label: 'LOW RISK — MINOR IMPACT',                   accent: '#2563eb' },
  SAFE:   { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: '#22c55e40', icon: ShieldCheck,  label: 'VERIFIED SAFE — CODE APPROVED BY AURA',     accent: '#16a34a' },
  DEFAULT:{ color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: '#8b5cf640', icon: ShieldOff,    label: 'ANALYZING IMPACT…',                         accent: '#7c3aed' },
};

function getRisk(riskStr) {
  const r = (riskStr || '').toUpperCase().trim();
  if (r.includes('HIGH'))   return RISK_CONFIG.HIGH;
  if (r.includes('MEDIUM')) return RISK_CONFIG.MEDIUM;
  if (r.includes('LOW'))    return RISK_CONFIG.LOW;
  if (r.includes('SAFE'))   return RISK_CONFIG.SAFE;
  return RISK_CONFIG.DEFAULT;
}

// ── Component ──────────────────────────────────────────────────────
const AuraChat = ({ repo, isDarkMode = true, onGraphHighlight }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [error, setError] = useState(null);
  const scrollRef = useRef();

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-show graph panel when a completed impact analysis is rendered
  useEffect(() => {
    if (!onGraphHighlight) return;
    const lastAssistant = [...messages].reverse().find(
      m => m.role === 'assistant' && m.content.includes('</IMPACT_ANALYSIS>')
    );
    if (!lastAssistant) return;
    const affFiles = lastAssistant.content.match(/<AFFECTED_FILES>([\s\S]*?)<\/AFFECTED_FILES>/i)?.[1]?.trim() || '';
    if (!affFiles) return;
    const files = affFiles.split(',').map(f => f.trim().replace(/\\/g, '/').toLowerCase()).filter(Boolean);
    if (files.length > 0) onGraphHighlight(new Set(files));
  }, [messages, onGraphHighlight]);

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(key);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;
    if (!repo) { setError('No repository selected.'); return; }

    setError(null);
    const question = input;
    setMessages(prev => [...prev,
      { role: 'user', content: question },
      { role: 'assistant', content: '' },
    ]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_name: repo, question }),
      });
      if (!response.ok) throw new Error(`Server Error (${response.status})`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulated = '';
      let graphTriggered = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });

        if (!graphTriggered) {
          const gm = accumulated.match(/<ui_graph>([\s\S]*?)<\/ui_graph>/);
          const im = accumulated.match(/<AFFECTED_FILES>([\s\S]*?)<\/AFFECTED_FILES>/i);
          if (gm || im) {
            const raw = (gm ? gm[1] : im[1]) || '';
            const files = raw.replace(/\r?\n|\r/g, '').split(',')
              .map(f => f.trim().replace(/\\/g, '/').toLowerCase()).filter(Boolean);
            if (files.length > 0 && onGraphHighlight) onGraphHighlight(new Set(files));
            graphTriggered = true;
          }
        }

        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: accumulated };
          return next;
        });
      }
    } catch (err) {
      setError(err.message);
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], content: '⚠️ **AURA Engine error.** Check backend logs.' };
        return next;
      });
    } finally {
      setIsTyping(false);
    }
  };

  // ── Theme ──────────────────────────────────────────────────────
  const bg       = isDarkMode ? '#0d1117' : '#fdf2f8';
  const surface  = isDarkMode ? '#161b22' : '#ffffff';
  const border   = isDarkMode ? '#21262d' : '#fce7f3';
  const muted    = isDarkMode ? '#6e7681' : '#be185d';
  const textPri  = isDarkMode ? '#e6edf3' : '#1e293b';
  const textSec  = isDarkMode ? '#8b949e' : '#9d4070';
  const accent   = isDarkMode ? '#3b82f6' : '#ec4899';
  const userBg   = isDarkMode ? 'linear-gradient(135deg, #1d4ed8, #7c3aed)' : 'linear-gradient(135deg, #db2777, #9333ea)';
  const botBg    = isDarkMode ? '#161b22' : '#ffffff';
  const codeBg   = isDarkMode ? '#0d1117' : '#fff0f7';

  // ── Message renderer ──────────────────────────────────────────
  const renderMessage = (msg, idx) => {
    const raw = msg.content;
    const displayText = raw.replace(/<ui_graph>[\s\S]*?<\/ui_graph>/g, '').trim();

    // Thinking state
    if (!displayText && msg.role === 'assistant') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', background: surface, border: `1px solid ${border}`, borderRadius: 16, alignSelf: 'flex-start', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: accent, opacity: 0.8, animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
            ))}
          </div>
          <span style={{ color: accent, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>AURA is analyzing...</span>
        </div>
      );
    }

    // ── Impact Analysis Block ──────────────────────────────────
    if (displayText.includes('<IMPACT_ANALYSIS>')) {
      const riskStr   = displayText.match(/<RISK_LEVEL>(.*?)<\/RISK_LEVEL>/)?.[1] || '';
      const suggestion= displayText.match(/<SUGGESTION>([\s\S]*?)<\/SUGGESTION>/)?.[1]?.trim() || '';
      const original  = displayText.match(/<ORIGINAL_CODE>([\s\S]*?)<\/ORIGINAL_CODE>/)?.[1]?.trim() || '';
      const safe      = displayText.match(/<SAFE_CODE>([\s\S]*?)<\/SAFE_CODE>/)?.[1]?.trim() || '';
      const affFiles  = displayText.match(/<AFFECTED_FILES>([\s\S]*?)<\/AFFECTED_FILES>/i)?.[1]?.trim() || '';
      const sysImpact = displayText.match(/<SYSTEM_IMPACT>([\s\S]*?)<\/SYSTEM_IMPACT>/)?.[1]?.trim() || '';
      const techImpact= displayText.match(/<TECHNICAL_IMPACT>([\s\S]*?)<\/TECHNICAL_IMPACT>/)?.[1]?.trim() || '';
      const userImpact= displayText.match(/<USER_IMPACT>([\s\S]*?)<\/USER_IMPACT>/)?.[1]?.trim() || '';

      const risk = getRisk(riskStr);
      const RiskIcon = risk.icon;
      const isSafe = riskStr.toUpperCase().includes('SAFE');
      const isLow  = riskStr.toUpperCase().includes('LOW') && !isSafe;
      const fileCount = affFiles ? affFiles.split(',').filter(Boolean).length : 0;
      const preText = displayText.split('<IMPACT_ANALYSIS>')[0].trim();
      const postMatch = displayText.match(/<\/IMPACT_ANALYSIS>([\s\S]*)$/i);
      const postText = postMatch ? postMatch[1].trim() : '';

      return (
        <div style={{ width: '100%' }}>
          {preText && (
            <div style={{ marginBottom: 12, padding: '10px 14px', background: botBg, border: `1px solid ${border}`, borderRadius: 14, color: textPri, fontSize: 13 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{preText}</ReactMarkdown>
            </div>
          )}

          <div style={{
            background: risk.bg, border: `1.5px solid ${risk.color}44`,
            borderLeft: `5px solid ${risk.color}`,
            borderRadius: 16, overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${risk.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: risk.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 12px ${risk.color}60` }}>
                  <RiskIcon size={18} color="white" />
                </div>
                <div>
                  <div style={{ color: risk.color, fontWeight: 800, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                    {risk.label}
                  </div>
                  <div style={{ color: muted, fontSize: 10, marginTop: 2 }}>
                    AURA Impact Analysis · {fileCount > 0 ? `${fileCount} module${fileCount !== 1 ? 's' : ''} affected` : 'Analyzing scope...'}
                  </div>
                </div>
              </div>
              <div style={{ background: risk.color, color: 'white', borderRadius: 8, padding: '4px 10px', fontSize: 10, fontWeight: 800, letterSpacing: 1, whiteSpace: 'nowrap' }}>
                {riskStr.trim() || 'ANALYZING'}
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Impact cards */}
              {(sysImpact || techImpact || userImpact) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                  {[
                    { label: 'System Impact', value: sysImpact,  icon: '🌐' },
                    { label: 'Technical Impact', value: techImpact, icon: '⚙️' },
                    { label: 'User Impact', value: userImpact,  icon: '👤' },
                  ].filter(c => c.value).map(({ label, value, icon }) => (
                    <div key={label} style={{ background: isDarkMode ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.7)', borderRadius: 10, padding: '10px 12px', border: `1px solid ${border}` }}>
                      <div style={{ color: muted, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 5 }}>{icon} {label}</div>
                      <div style={{ color: textPri, fontSize: 11, lineHeight: 1.5 }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggestion */}
              {suggestion && (
                <div style={{ background: isSafe || isLow ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isSafe || isLow ? '#22c55e44' : border}`, borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 14, marginTop: 1 }}>{isSafe ? '✅' : isLow ? '💡' : '⚡'}</span>
                  <div>
                    <div style={{ color: isSafe || isLow ? '#22c55e' : risk.color, fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>AURA Suggestion</div>
                    <div style={{ color: textPri, fontSize: 12, lineHeight: 1.6 }}>{suggestion}</div>
                  </div>
                </div>
              )}

              {/* Affected files */}
              {affFiles && fileCount > 0 && (
                <div style={{ background: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ color: muted, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>Affected Files</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {affFiles.split(',').filter(Boolean).map((f, i) => (
                      <span key={i} style={{ background: `${risk.color}18`, border: `1px solid ${risk.color}33`, color: risk.color, borderRadius: 5, padding: '2px 8px', fontSize: 10, fontFamily: 'Consolas, monospace', fontWeight: 600 }}>
                        {f.trim().split('/').pop()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Code diff */}
              {(original || safe) && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {/* Original code */}
                    {original && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: risk.color }} />
                          <span style={{ color: risk.color, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                            {isSafe ? 'Submitted Code' : 'Current Code'}
                          </span>
                        </div>
                        <pre style={{ background: codeBg, color: isDarkMode ? '#9ca3af' : '#6b7280', padding: 14, borderRadius: 10, fontSize: 11, overflow: 'auto', maxHeight: 260, fontFamily: 'Consolas, monospace', lineHeight: 1.65, margin: 0, border: `1px solid ${risk.color}30`, whiteSpace: 'pre', overflowX: 'auto' }}>
                          <code style={{ whiteSpace: 'pre' }}>{original}</code>
                        </pre>
                      </div>
                    )}

                    {/* Safe / Recommended code */}
                    {safe && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                            <span style={{ color: '#22c55e', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                              {isSafe ? 'Verified Implementation ✓' : 'AURA Recommended'}
                            </span>
                          </div>
                          <button
                            onClick={() => copy(safe, `safe-${idx}`)}
                            style={{ background: 'none', border: `1px solid ${border}`, cursor: 'pointer', color: muted, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, fontSize: 10, transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#22c55e'; e.currentTarget.style.color = '#22c55e'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = muted; }}
                          >
                            {copiedIndex === `safe-${idx}` ? <Check size={11} color="#22c55e" /> : <Copy size={11} />}
                            <span>{copiedIndex === `safe-${idx}` ? 'Copied!' : 'Copy'}</span>
                          </button>
                        </div>
                        <pre style={{ background: codeBg, color: isDarkMode ? (isSafe ? '#86efac' : '#d1fae5') : '#065f46', padding: 14, borderRadius: 10, fontSize: 11, overflow: 'auto', maxHeight: 260, fontFamily: 'Consolas, monospace', lineHeight: 1.65, margin: 0, border: '1px solid #22c55e44', boxShadow: isSafe ? '0 0 16px rgba(34,197,94,0.12)' : 'none', whiteSpace: 'pre', overflowX: 'auto' }}>
                          <code style={{ whiteSpace: 'pre' }}>{safe}</code>
                        </pre>
                        {isSafe && (
                          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <ShieldCheck size={11} color="#22c55e" />
                            <span style={{ color: '#22c55e', fontSize: 10, fontWeight: 600 }}>This code has been verified safe by AURA</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {postText && (
            <div style={{ marginTop: 10, padding: '10px 14px', background: botBg, border: `1px solid ${border}`, borderRadius: 14, color: textPri, fontSize: 13 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{postText}</ReactMarkdown>
            </div>
          )}
        </div>
      );
    }

    // ── Standard message ──────────────────────────────────────
    const isUser = msg.role === 'user';
    return (
      <div style={{
        maxWidth: isUser ? '74%' : '90%',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        background: isUser ? 'none' : botBg,
        color: isUser ? 'white' : textPri,
        borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
        padding: isUser ? 0 : '12px 16px',
        border: isUser ? 'none' : `1px solid ${border}`,
        fontSize: 13, lineHeight: 1.7,
        boxShadow: isUser ? 'none' : '0 2px 8px rgba(0,0,0,0.08)',
        position: 'relative',
      }}>
        {isUser ? (
          <div style={{ background: userBg, padding: '11px 18px', borderRadius: '20px 20px 4px 20px', boxShadow: '0 4px 16px rgba(99,102,241,0.3)' }}>
            <span style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{displayText}</span>
          </div>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code: ({ inline, children }) => inline ? (
                <code style={{ background: codeBg, color: isDarkMode ? '#7dd3fc' : '#be185d', padding: '1px 6px', borderRadius: 4, fontSize: '0.84em', fontFamily: 'Consolas, monospace', border: `1px solid ${border}` }}>{children}</code>
              ) : (
                <pre style={{ background: codeBg, border: `1px solid ${border}`, padding: '12px 16px', borderRadius: 10, overflow: 'auto', margin: '10px 0', fontFamily: 'Consolas, monospace', fontSize: 12, lineHeight: 1.65, whiteSpace: 'pre', overflowX: 'auto' }}>
                  <code style={{ fontFamily: 'inherit', whiteSpace: 'pre' }}>{children}</code>
                </pre>
              ),
              a: ({ children, href }) => (
                <a href={href} style={{ color: '#60a5fa', textDecoration: 'underline' }}>{children}</a>
              ),
              strong: ({ children }) => <strong style={{ color: isDarkMode ? '#e2e8f0' : '#1e293b', fontWeight: 700 }}>{children}</strong>,
              blockquote: ({ children }) => (
                <blockquote style={{ borderLeft: `3px solid ${accent}`, paddingLeft: 12, marginLeft: 0, color: textSec, fontStyle: 'italic' }}>{children}</blockquote>
              ),
            }}
          >
            {displayText}
          </ReactMarkdown>
        )}
      </div>
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: bg }}>

      {/* ── Status bar ── */}
      <div style={{ padding: '7px 20px', background: surface, borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: repo ? '#22c55e' : '#ef4444', boxShadow: repo ? '0 0 6px #22c55e' : 'none' }} />
          <span style={{ color: muted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>
            {repo ? `Context: ${repo}` : 'NO CONTEXT — Select a repository'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {onGraphHighlight && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Network size={10} color={accent} />
              <span style={{ color: muted, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Graph Sync</span>
            </div>
          )}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444' }}>
              <AlertCircle size={10} />
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>Stream Error</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, paddingTop: 60, opacity: 0.5 }}>
            <div style={{ width: 64, height: 64, background: surface, border: `1px solid ${border}`, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isDarkMode ? '0 0 24px rgba(59,130,246,0.1)' : '0 0 24px rgba(236,72,153,0.15)' }}>
              <Cpu size={30} color={accent} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: textPri, fontWeight: 800, fontSize: 14, letterSpacing: 0.5 }}>AURA Agent Online</div>
              <div style={{ color: muted, fontSize: 12, marginTop: 4 }}>Ask about architecture, code, or paste code for audit</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 380 }}>
              {['What does this codebase do?', 'Explain the architecture', 'Find security issues'].map(s => (
                <button key={s} onClick={() => { setInput(s); }} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 20, padding: '6px 14px', color: muted, fontSize: 11, cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; }} onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = muted; }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'assistant' && messages[i - 1]?.role !== 'assistant' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div style={{ width: 20, height: 20, background: isDarkMode ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'linear-gradient(135deg, #ec4899, #9333ea)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Cpu size={11} color="white" />
                </div>
                <span style={{ color: muted, fontSize: 10, fontWeight: 700 }}>AURA</span>
              </div>
            )}
            {renderMessage(msg, i)}
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      {/* ── Input ── */}
      <div style={{ padding: '14px 20px 18px', background: isDarkMode ? 'rgba(13,17,23,0.85)' : 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
        {error && (
          <div style={{ marginBottom: 10, padding: '8px 14px', background: isDarkMode ? '#1a0a0a' : '#fef2f2', border: '1px solid #ef444444', borderRadius: 8, color: '#ef4444', fontSize: 11, fontWeight: 600 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: surface, border: `1px solid ${border}`, borderRadius: 20, padding: '8px 8px 8px 18px', transition: 'border-color 0.2s, box-shadow 0.2s' }}
          onFocusCapture={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.boxShadow = isDarkMode ? '0 0 0 3px rgba(59,130,246,0.1)' : '0 0 0 3px rgba(236,72,153,0.12)'; }}
          onBlurCapture={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={repo ? `Ask about ${repo}... (Enter ↵ send · Shift+Enter new line)` : 'Select a repository to begin...'}
            disabled={isTyping || !repo}
            rows={1}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: textPri, fontSize: 13, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 140, overflow: 'auto', padding: '6px 0' }}
          />
          <button
            onClick={sendMessage}
            disabled={isTyping || !input.trim() || !repo}
            style={{ width: 40, height: 40, borderRadius: 14, border: 'none', cursor: isTyping || !input.trim() || !repo ? 'not-allowed' : 'pointer', background: isTyping || !input.trim() || !repo ? (isDarkMode ? '#21262d' : '#fce7f3') : (isDarkMode ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'linear-gradient(135deg, #ec4899, #9333ea)'), color: isTyping || !input.trim() || !repo ? muted : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0, boxShadow: isTyping || !input.trim() || !repo ? 'none' : (isDarkMode ? '0 4px 14px rgba(59,130,246,0.4)' : '0 4px 14px rgba(236,72,153,0.35)') }}
          >
            {isTyping ? <Zap size={16} style={{ animation: 'pulse 1s infinite' }} /> : <Send size={15} />}
          </button>
        </div>
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 16, opacity: 0.28 }}>
          {['NVIDIA NEMOTRON', 'NEO4J GRAPH RAG', 'FAISS VECTOR DB'].map(t => (
            <span key={t} style={{ color: muted, fontSize: 8, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase' }}>{t}</span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
};

export default AuraChat;
