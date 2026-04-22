import React, { useState } from 'react';
import { Database, ChevronDown, Activity, BarChart2, MessageSquare, FileText, Newspaper, GitBranch, Sun, Moon } from 'lucide-react';

const Navbar = ({ repos = [], onSelectRepo, currentRepo, currentPage, onNavigate, isDarkMode, onToggleDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = currentRepo ? [
    { id: 'notes', label: 'Release Notes', Icon: Newspaper },
    { id: 'biz', label: 'Business', Icon: FileText },
    { id: 'tech', label: 'Tech Audit', Icon: GitBranch },
    { id: 'graph', label: 'Graph', Icon: BarChart2 },
    { id: 'chat', label: 'Ask AURA', Icon: MessageSquare },
  ] : [];

  const handleSelect = (repo) => {
    const repoName = typeof repo === 'object' ? repo.repo_name || repo.name : repo;
    onSelectRepo(repoName);
    setIsOpen(false);
  };

  const bg = isDarkMode ? '#0d1117' : '#fff0f7';
  const border = isDarkMode ? '#21262d' : '#fce7f3';
  const textMuted = isDarkMode ? '#6e7681' : '#be185d';
  const textActive = isDarkMode ? '#e6edf3' : '#1e293b';
  const dropBg = isDarkMode ? '#161b22' : '#fff5fb';
  const dropBorder = isDarkMode ? '#30363d' : '#fce7f3';
  const dropHover = isDarkMode ? '#21262d' : '#fdf2f8';
  const navAccent = isDarkMode ? '#3b82f6' : '#ec4899';

  return (
    <nav style={{ background: bg, borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 52, flexShrink: 0, position: 'relative', zIndex: 50 }}>

      {/* Left: Logo + Nav tabs */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 0 }}>
        {/* Logo */}
        <div
          onClick={() => onNavigate(null)}
          style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', marginRight: 24, opacity: 0.92, transition: 'opacity 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = 1}
          onMouseLeave={e => e.currentTarget.style.opacity = 0.92}
        >
          {/* Hexagonal network logo */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <defs>
              <linearGradient id="navLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={navAccent}/>
                <stop offset="100%" stopColor="#8b5cf6"/>
              </linearGradient>
            </defs>
            {/* Hexagon outline */}
            <path d="M14 2L24.39 8V20L14 26L3.61 20V8Z" stroke="url(#navLogoGrad)" strokeWidth="1.5" fill="none"/>
            {/* Connection lines from center */}
            <line x1="14" y1="14" x2="14" y2="5.5"  stroke={navAccent} strokeWidth="1"   opacity="0.7"/>
            <line x1="14" y1="14" x2="21" y2="9.75"  stroke={navAccent} strokeWidth="1"   opacity="0.7"/>
            <line x1="14" y1="14" x2="21" y2="18.25" stroke="#8b5cf6" strokeWidth="1"   opacity="0.7"/>
            <line x1="14" y1="14" x2="14" y2="22.5"  stroke="#8b5cf6" strokeWidth="1"   opacity="0.7"/>
            <line x1="14" y1="14" x2="7"  y2="18.25" stroke="#8b5cf6" strokeWidth="1"   opacity="0.7"/>
            <line x1="14" y1="14" x2="7"  y2="9.75"  stroke={navAccent} strokeWidth="1"   opacity="0.7"/>
            {/* Satellite nodes */}
            <circle cx="14"  cy="5.5"  r="1.6" fill={navAccent}/>
            <circle cx="21"  cy="9.75" r="1.6" fill={navAccent}/>
            <circle cx="21"  cy="18.25"r="1.6" fill="#8b5cf6"/>
            <circle cx="14"  cy="22.5" r="1.6" fill="#8b5cf6"/>
            <circle cx="7"   cy="18.25"r="1.6" fill="#8b5cf6"/>
            <circle cx="7"   cy="9.75" r="1.6" fill={navAccent}/>
            {/* Central node */}
            <circle cx="14"  cy="14"   r="3"   fill="url(#navLogoGrad)"/>
          </svg>
          <span style={{ color: textActive, fontWeight: 900, fontSize: 14, letterSpacing: 3, textTransform: 'uppercase' }}>AURA</span>
        </div>

        {/* Nav tabs */}
        {navItems.map(({ id, label, Icon }) => {
          const isActive = currentPage === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0 14px', height: '100%',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: isActive ? `2px solid ${navAccent}` : '2px solid transparent',
                color: isActive ? navAccent : textMuted,
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = textActive; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = textMuted; }}
            >
              <Icon size={13} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: dark mode + repo selector + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Dark mode toggle */}
        <button
          onClick={onToggleDarkMode}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{ background: 'none', border: `1px solid ${border}`, borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: textMuted, display: 'flex', alignItems: 'center' }}
          onMouseEnter={e => { e.currentTarget.style.color = textActive; e.currentTarget.style.borderColor = navAccent; }}
          onMouseLeave={e => { e.currentTarget.style.color = textMuted; e.currentTarget.style.borderColor = border; }}
        >
          {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Repo Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: isDarkMode ? '#161b22' : '#fff5fb', border: `1px solid ${dropBorder}`, borderRadius: 8, padding: '5px 10px', cursor: 'pointer', transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = navAccent}
            onMouseLeave={e => e.currentTarget.style.borderColor = dropBorder}
          >
            <Database size={12} color={navAccent} />
            <span style={{ color: textMuted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentRepo || 'Memory Log'}
            </span>
            <ChevronDown size={11} color={textMuted} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {isOpen && (
            <>
              <div onClick={() => setIsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, width: 280, background: dropBg, border: `1px solid ${dropBorder}`, borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.3)', zIndex: 50, overflow: 'hidden' }}>
                <div style={{ padding: '8px 14px', borderBottom: `1px solid ${dropBorder}` }}>
                  <span style={{ color: textMuted, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>Previously Analyzed</span>
                </div>
                {repos.length === 0 ? (
                  <div style={{ padding: '14px 16px', color: textMuted, fontSize: 11, fontStyle: 'italic' }}>No logs found...</div>
                ) : (
                  repos.map((repo, i) => {
                    const name = typeof repo === 'object' ? (repo.repo_name || repo.name) : repo;
                    return (
                      <button
                        key={i}
                        onClick={() => handleSelect(repo)}
                        style={{ width: '100%', textAlign: 'left', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: isDarkMode ? '#c9d1d9' : '#374151', fontSize: 12, fontWeight: 600, transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = dropHover}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <span>{name}</span>
                        <Activity size={11} color={navAccent} style={{ opacity: 0.5 }} />
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 6, height: 6, background: '#22c55e', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
          <span style={{ color: textMuted, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>Active</span>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
