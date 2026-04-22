import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import CircularProgress from '@mui/material/CircularProgress';

import Navbar from './components/Navbar';
import DocumentViewer from './components/DocumentViewer';
import DependencyGraph from './components/DependencyGraph';
import AuraChat from './components/AuraChat';

// GitHub icon as SVG (no extra dep needed)
const GithubIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);

function App() {
  const [url, setUrl] = useState('');
  const [repoName, setRepoName] = useState('');
  const [docType, setDocType] = useState('both');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const [techReport, setTechReport] = useState('');
  const [bizReport, setBizReport] = useState('');
  const [notes, setNotes] = useState('');
  const [graph, setGraph] = useState({ nodes: [], links: [] });
  const [highlightNodes, setHighlightNodes] = useState(new Set());

  const [history, setHistory] = useState([]);
  const [page, setPage] = useState('notes');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);

  const mounted = useRef(true);

  const theme = useMemo(() => createTheme({
    palette: {
      mode: isDarkMode ? 'dark' : 'light',
      primary: { main: isDarkMode ? '#3b82f6' : '#ec4899' },
      background: {
        default: isDarkMode ? '#0b0f19' : '#fdf2f8',
        paper: isDarkMode ? '#0d1117' : '#ffffff',
      },
    },
  }), [isDarkMode]);

  useEffect(() => {
    mounted.current = true;
    fetchHistory();
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!loading) { setLoadingMessage(''); return; }
    const msgs = [
      'Cloning repository...', 'Mapping AST dependencies in Neo4j...',
      'Vectorizing code into FAISS...', 'Consulting AURA AI Agents...',
      'Drafting architectural chapters...', 'Visualizing the network graph...',
      'Applying finishing touches...',
    ];
    let i = 0;
    setLoadingMessage(msgs[0]);
    const iv = setInterval(() => { i = (i + 1) % msgs.length; setLoadingMessage(msgs[i]); }, 6000);
    return () => clearInterval(iv);
  }, [loading]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/repos');
      if (mounted.current) setHistory(res.data.repos || []);
    } catch {}
  };

  const loadRepo = useCallback(async (name) => {
    await Promise.allSettled([
      axios.get(`http://localhost:8000/api/reports/technical/${name}`)
        .then(r => setTechReport(r.data.content))
        .catch(() => setTechReport('')),
      axios.get(`http://localhost:8000/api/reports/business/${name}`)
        .then(r => setBizReport(r.data.content))
        .catch(() => setBizReport('')),
      axios.get(`http://localhost:8000/api/notes/${name}`)
        .then(r => setNotes(r.data.content))
        .catch(() => setNotes('')),
      axios.get(`http://localhost:8000/api/graph/${name}`)
        .then(r => setGraph(r.data))
        .catch(() => setGraph({ nodes: [], links: [] })),
    ]);
    if (!mounted.current) return;
    setHighlightNodes(new Set());
    setPage('notes');
    setIsMaximized(false);
  }, []);

  const analyze = async (e) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:8000/api/analyze', { url, doc_type: docType });
      setRepoName(res.data.repo_name);
      await loadRepo(res.data.repo_name);
      fetchHistory();
    } catch (err) {
      console.error('Analysis failed', err);
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const handleSelectRepo = useCallback((name) => {
    setRepoName(name);
    loadRepo(name);
  }, [loadRepo]);

  const handleNavigate = useCallback((newPage) => {
    if (newPage === null) {
      setRepoName('');
      setPage('notes');
    } else {
      setPage(newPage);
    }
    setIsMaximized(false);
  }, []);

  const handleGraphHighlight = useCallback((nodes) => {
    setHighlightNodes(nodes);
  }, []);

  const toggleMaximize = useCallback(() => setIsMaximized(v => !v), []);

  // ── Styles ──
  const bg = isDarkMode ? '#0b0f19' : '#fdf2f8';
  const surface = isDarkMode ? 'rgba(13,17,23,0.85)' : '#ffffff';
  const border = isDarkMode ? 'rgba(59,130,246,0.25)' : 'rgba(236,72,153,0.2)';
  const textPrimary = isDarkMode ? '#e6edf3' : '#1e293b';
  const textMuted = isDarkMode ? '#6e7681' : '#be185d';
  const accent = isDarkMode ? '#3b82f6' : '#ec4899';
  const selectBg = isDarkMode ? 'rgba(59,130,246,0.08)' : 'rgba(236,72,153,0.06)';
  const selectBorder = isDarkMode ? 'rgba(59,130,246,0.2)' : 'rgba(236,72,153,0.25)';

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles styles={{
        '@media print': { '.no-print': { display: 'none !important' } },
        '@keyframes float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      }} />

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: bg, overflow: 'hidden' }}>

        {/* ── Navbar (hidden when maximized) ── */}
        {!isMaximized && (
          <Navbar
            repos={history}
            onSelectRepo={handleSelectRepo}
            currentRepo={repoName}
            currentPage={page}
            onNavigate={handleNavigate}
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode(v => !v)}
          />
        )}

        {/* ── Landing Page ── */}
        {!repoName && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
            {/* Background decorations */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '20%', left: '15%', width: 300, height: 300, background: isDarkMode ? 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)', borderRadius: '50%' }} />
              <div style={{ position: 'absolute', bottom: '20%', right: '15%', width: 400, height: 400, background: isDarkMode ? 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(147,51,234,0.08) 0%, transparent 70%)', borderRadius: '50%' }} />
            </div>

            <div style={{ textAlign: 'center', maxWidth: 660, width: '100%', position: 'relative' }}>
              {/* Logo */}
              <div style={{ marginBottom: 36 }}>
                <div style={{
                  display: 'inline-flex', width: 92, height: 92,
                  background: isDarkMode ? 'rgba(13,17,23,0.9)' : 'rgba(255,255,255,0.9)',
                  border: isDarkMode ? '1.5px solid rgba(59,130,246,0.3)' : '1.5px solid rgba(236,72,153,0.35)',
                  borderRadius: 28, alignItems: 'center', justifyContent: 'center',
                  marginBottom: 20,
                  boxShadow: isDarkMode ? '0 0 0 6px rgba(59,130,246,0.06), 0 0 48px rgba(59,130,246,0.18)' : '0 0 0 6px rgba(236,72,153,0.08), 0 0 48px rgba(236,72,153,0.2)',
                  animation: 'float 4s ease-in-out infinite',
                }}>
                  <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                    <defs>
                      <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6"/>
                        <stop offset="100%" stopColor="#8b5cf6"/>
                      </linearGradient>
                    </defs>
                    <path d="M26 4L45.05 15V37L26 48L6.95 37V15Z" stroke="url(#heroGrad)" strokeWidth="2" fill="none"/>
                    <line x1="26" y1="26" x2="26" y2="10"   stroke="#3b82f6" strokeWidth="1.5" opacity="0.65"/>
                    <line x1="26" y1="26" x2="39" y2="18.5" stroke="#3b82f6" strokeWidth="1.5" opacity="0.65"/>
                    <line x1="26" y1="26" x2="39" y2="33.5" stroke="#8b5cf6" strokeWidth="1.5" opacity="0.65"/>
                    <line x1="26" y1="26" x2="26" y2="42"   stroke="#8b5cf6" strokeWidth="1.5" opacity="0.65"/>
                    <line x1="26" y1="26" x2="13" y2="33.5" stroke="#8b5cf6" strokeWidth="1.5" opacity="0.65"/>
                    <line x1="26" y1="26" x2="13" y2="18.5" stroke="#3b82f6" strokeWidth="1.5" opacity="0.65"/>
                    <circle cx="26" cy="10"   r="2.8" fill="#3b82f6"/>
                    <circle cx="39" cy="18.5" r="2.8" fill="#3b82f6"/>
                    <circle cx="39" cy="33.5" r="2.8" fill="#8b5cf6"/>
                    <circle cx="26" cy="42"   r="2.8" fill="#8b5cf6"/>
                    <circle cx="13" cy="33.5" r="2.8" fill="#8b5cf6"/>
                    <circle cx="13" cy="18.5" r="2.8" fill="#3b82f6"/>
                    <circle cx="26" cy="26"   r="5.5" fill="url(#heroGrad)"/>
                    <circle cx="26" cy="26"   r="3"   fill="white" opacity="0.3"/>
                  </svg>
                </div>
                <h1 style={{ color: textPrimary, fontSize: 60, fontWeight: 900, letterSpacing: -3, margin: '0 0 8px', lineHeight: 1 }}>AURA</h1>
                <p style={{ color: textMuted, fontSize: 17, margin: 0, fontWeight: 400 }}>
                  AI-powered codebase intelligence · dependency visualization · architecture audit
                </p>
              </div>

              {/* Input card */}
              <form onSubmit={analyze}>
                <div style={{
                  background: surface, border: `1px solid ${border}`,
                  borderRadius: 22, padding: 6,
                  boxShadow: isDarkMode ? '0 0 60px rgba(59,130,246,0.08), 0 8px 32px rgba(0,0,0,0.4)' : '0 8px 40px rgba(0,0,0,0.1)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', color: textMuted }}>
                    <GithubIcon />
                  </div>
                  <input
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://github.com/owner/repository"
                    style={{
                      flex: 1, background: 'none', border: 'none', outline: 'none',
                      color: textPrimary, fontSize: 15, padding: '14px 0',
                      fontFamily: 'inherit',
                    }}
                  />
                  <select
                    value={docType}
                    onChange={e => setDocType(e.target.value)}
                    style={{
                      background: selectBg, border: `1px solid ${selectBorder}`,
                      borderRadius: 12, color: isDarkMode ? '#93c5fd' : '#ec4899',
                      fontSize: 12, padding: '10px 12px', fontWeight: 700,
                      cursor: 'pointer', outline: 'none', flexShrink: 0,
                    }}
                  >
                    <option value="both">Both Reports</option>
                    <option value="technical">Technical Only</option>
                    <option value="business">Business Only</option>
                  </select>
                  <button
                    type="submit"
                    disabled={loading || !url.trim()}
                    style={{
                      background: loading || !url.trim() ? (isDarkMode ? '#21262d' : '#fce7f3') : (isDarkMode ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'linear-gradient(135deg, #ec4899, #9333ea)'),
                      color: loading || !url.trim() ? textMuted : 'white',
                      border: 'none', borderRadius: 16, padding: '12px 28px',
                      fontSize: 14, fontWeight: 700, cursor: loading || !url.trim() ? 'not-allowed' : 'pointer',
                      letterSpacing: 0.3, whiteSpace: 'nowrap', flexShrink: 0,
                      boxShadow: loading || !url.trim() ? 'none' : (isDarkMode ? '0 4px 16px rgba(59,130,246,0.4)' : '0 4px 16px rgba(236,72,153,0.35)'),
                      display: 'flex', alignItems: 'center', gap: 8,
                      transition: 'all 0.2s',
                    }}
                  >
                    {loading && <CircularProgress size={14} color="inherit" />}
                    {loading ? 'Analyzing...' : 'Analyze'}
                  </button>
                </div>
              </form>

              {/* Loading message */}
              {loading && (
                <div style={{ marginTop: 20, color: accent, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>⚡</span>
                  {loadingMessage}
                </div>
              )}

              {/* Feature pills */}
              {!loading && (
                <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {['Dependency Graph', 'Architecture Audit', 'Business Strategy', 'AI Chat', 'Release Notes'].map(f => (
                    <span key={f} style={{ background: isDarkMode ? 'rgba(59,130,246,0.08)' : 'rgba(236,72,153,0.07)', border: `1px solid ${isDarkMode ? 'rgba(59,130,246,0.2)' : 'rgba(236,72,153,0.25)'}`, borderRadius: 20, padding: '4px 12px', color: isDarkMode ? '#93c5fd' : '#db2777', fontSize: 11, fontWeight: 600 }}>
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Dashboard ── */}
        {repoName && (
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

            {/* ── Document / Graph tabs (conditionally rendered, no persistent state needed) ── */}
            {page !== 'chat' && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
                {page === 'notes' && (
                  <DocumentViewer content={notes} type="notes" repo={repoName} isMaximized={isMaximized} onToggleMaximize={toggleMaximize} />
                )}
                {page === 'biz' && (
                  <DocumentViewer content={bizReport} type="business" repo={repoName} isMaximized={isMaximized} onToggleMaximize={toggleMaximize} />
                )}
                {page === 'tech' && (
                  <DocumentViewer content={techReport} type="tech" repo={repoName} isMaximized={isMaximized} onToggleMaximize={toggleMaximize} />
                )}
                {page === 'graph' && (
                  <DependencyGraph repo={repoName} graphData={graph} highlightNodes={highlightNodes} isMaximized={isMaximized} onToggleMaximize={toggleMaximize} isDarkMode={isDarkMode} />
                )}
              </div>
            )}

            {/* ── Chat tab — always mounted so messages are never lost ── */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex',
              visibility: page === 'chat' ? 'visible' : 'hidden',
              pointerEvents: page === 'chat' ? 'auto' : 'none',
              zIndex: page === 'chat' ? 1 : 0,
            }}>
              {/* Chat panel */}
              <div style={{ flex: highlightNodes.size > 0 ? '0 0 56%' : 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'flex 0.35s ease' }}>
                <AuraChat repo={repoName} isDarkMode={isDarkMode} onGraphHighlight={handleGraphHighlight} />
              </div>

              {/* Side graph panel — appears when chat highlights nodes */}
              {highlightNodes.size > 0 && (
                <div style={{ flex: '0 0 44%', borderLeft: `1px solid ${isDarkMode ? '#21262d' : '#e2e8f0'}`, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 20, background: isDarkMode ? 'rgba(13,17,23,0.92)' : 'rgba(255,255,255,0.92)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 8, padding: '5px 12px', backdropFilter: 'blur(8px)' }}>
                    <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 700 }}>
                      ⚡ {highlightNodes.size} module{highlightNodes.size !== 1 ? 's' : ''} impacted
                    </span>
                  </div>
                  <button
                    onClick={() => setHighlightNodes(new Set())}
                    style={{ position: 'absolute', top: 10, right: 10, zIndex: 20, background: isDarkMode ? 'rgba(13,17,23,0.92)' : 'rgba(255,255,255,0.92)', border: `1px solid ${isDarkMode ? '#21262d' : '#e2e8f0'}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: textMuted, fontSize: 11, backdropFilter: 'blur(8px)' }}
                  >
                    ✕ Clear
                  </button>
                  <DependencyGraph repo={repoName} graphData={graph} highlightNodes={highlightNodes} isDarkMode={isDarkMode} />
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;
