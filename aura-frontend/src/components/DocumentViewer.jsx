import React, { useState, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Download, ZoomIn, ZoomOut, Printer, Maximize2, Minimize2, FileText, BookOpen, ChevronRight } from 'lucide-react';

const typeConfig = {
  notes:    { label: 'Release Notes',      color: '#22c55e', accent: '#16a34a', bg: '#f0fdf4' },
  business: { label: 'Business Strategy',  color: '#3b82f6', accent: '#1d4ed8', bg: '#eff6ff' },
  tech:     { label: 'Technical Audit',    color: '#8b5cf6', accent: '#7c3aed', bg: '#f5f3ff' },
};

// Build a URL-safe id from heading text
function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Extract flat text from React children (handles nested elements)
function childText(children) {
  if (!children) return '';
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(childText).join('');
  if (children?.props?.children) return childText(children.props.children);
  return '';
}

const DocumentViewer = ({ content = '', type = 'notes', repo = '', isMaximized, onToggleMaximize }) => {
  const [zoom, setZoom] = useState(100);
  const [tocOpen, setTocOpen] = useState(true);
  const [activeSlug, setActiveSlug] = useState('');
  const pageAreaRef = useRef();
  const cfg = typeConfig[type] || typeConfig.notes;

  // Parse headings from raw markdown to build TOC
  const toc = useMemo(() => {
    const lines = content.split('\n');
    const entries = [];
    for (const line of lines) {
      const m = line.match(/^(#{1,3})\s+(.+)/);
      if (m) {
        const level = m[1].length;
        const text = m[2].trim();
        entries.push({ level, text, slug: slugify(text) });
      }
    }
    return entries;
  }, [content]);

  const scrollToHeading = (slug) => {
    setActiveSlug(slug);
    const el = pageAreaRef.current?.querySelector(`#${CSS.escape(slug)}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const downloadDoc = () => {
    const el = document.createElement('a');
    el.href = URL.createObjectURL(new Blob([content], { type: 'text/markdown' }));
    el.download = `AURA_${type}_${repo}.md`;
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
  };

  const btnStyle = () => ({
    background: 'none',
    border: 'none', cursor: 'pointer', color: '#d4d4d4',
    padding: '5px 7px', borderRadius: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.15s',
  });

  // Heading renderer factory — attaches id for scroll targeting
  const makeHeading = (Tag, style) => ({ children }) => {
    const text = childText(children);
    const slug = slugify(text);
    return <Tag id={slug} style={{ ...style, scrollMarginTop: 24 }}>{children}</Tag>;
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#525659', overflow: 'hidden' }}>

      {/* ── Acrobat Top Toolbar ── */}
      <div style={{ background: '#3c3c3c', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', padding: '0 12px', height: 42, flexShrink: 0, gap: 12 }}>

        {/* TOC toggle */}
        <button
          onClick={() => setTocOpen(v => !v)}
          title={tocOpen ? 'Hide Bookmarks' : 'Show Bookmarks'}
          style={{ ...btnStyle(), gap: 5, fontSize: 11, color: tocOpen ? cfg.color : '#888', padding: '5px 10px', background: tocOpen ? 'rgba(255,255,255,0.07)' : 'none', borderRadius: 5 }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          onMouseLeave={e => e.currentTarget.style.background = tocOpen ? 'rgba(255,255,255,0.07)' : 'none'}
        >
          <BookOpen size={14} />
          <span style={{ fontWeight: 600, letterSpacing: 0.3 }}>Bookmarks</span>
        </button>

        <div style={{ width: 1, height: 22, background: '#555', flexShrink: 0 }} />

        {/* File name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <div style={{ background: cfg.color, width: 22, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileText size={12} color="white" />
          </div>
          <span style={{ color: '#d4d4d4', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            AURA_{type.toUpperCase()}_{repo}.pdf
          </span>
        </div>

        {/* Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#2a2a2a', borderRadius: 5, padding: '3px 8px', flexShrink: 0 }}>
          <button onClick={() => setZoom(z => Math.max(40, z - 10))} style={btnStyle()} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'} onMouseLeave={e => e.currentTarget.style.background = 'none'} title="Zoom Out">
            <ZoomOut size={14} />
          </button>
          <button onClick={() => setZoom(100)} style={{ ...btnStyle(), color: '#a0a0a0', fontSize: 12, minWidth: 44, textAlign: 'center' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            {zoom}%
          </button>
          <button onClick={() => setZoom(z => Math.min(200, z + 10))} style={btnStyle()} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'} onMouseLeave={e => e.currentTarget.style.background = 'none'} title="Zoom In">
            <ZoomIn size={14} />
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          {[
            { onClick: downloadDoc, title: 'Download', Icon: Download },
            { onClick: () => window.print(), title: 'Print', Icon: Printer },
            { onClick: onToggleMaximize, title: isMaximized ? 'Restore' : 'Maximize', Icon: isMaximized ? Minimize2 : Maximize2 },
          ].map(({ onClick, title, Icon }) => (
            <button
              key={title} onClick={onClick} title={title}
              style={btnStyle()}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Acrobat Secondary Bar ── */}
      <div style={{ background: '#474747', display: 'flex', alignItems: 'center', padding: '0 16px', height: 28, borderBottom: '1px solid #333', flexShrink: 0, gap: 16 }}>
        <span style={{ color: cfg.color, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase' }}>{cfg.label}</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: '#666', fontSize: 10 }}>AURA Document Intelligence · {repo}</span>
      </div>

      {/* ── Body: TOC sidebar + page area ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Bookmarks / TOC panel ── */}
        {tocOpen && toc.length > 0 && (
          <div style={{
            width: 230, flexShrink: 0, background: '#2d2d2d',
            borderRight: '1px solid #1e1e1e',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', gap: 6 }}>
              <BookOpen size={11} color={cfg.color} />
              <span style={{ color: '#aaa', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>Contents</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
              {toc.map((item, i) => {
                const isActive = activeSlug === item.slug;
                const indent = (item.level - 1) * 14;
                const isH1 = item.level === 1;
                const isH2 = item.level === 2;
                return (
                  <button
                    key={i}
                    onClick={() => scrollToHeading(item.slug)}
                    style={{
                      width: '100%', textAlign: 'left', background: isActive ? `${cfg.color}20` : 'none',
                      border: 'none', borderLeft: isActive ? `3px solid ${cfg.color}` : '3px solid transparent',
                      cursor: 'pointer', padding: `${isH1 ? 7 : 5}px 12px ${isH1 ? 7 : 5}px ${14 + indent}px`,
                      display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderLeftColor = `${cfg.color}60`; } }}
                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderLeftColor = 'transparent'; } }}
                  >
                    {isH1 && <ChevronRight size={10} color={isActive ? cfg.color : '#666'} style={{ flexShrink: 0 }} />}
                    {isH2 && <div style={{ width: 4, height: 4, borderRadius: '50%', background: isActive ? cfg.color : '#555', flexShrink: 0 }} />}
                    {item.level === 3 && <div style={{ width: 3, height: 3, borderRadius: '50%', background: isActive ? cfg.color : '#444', flexShrink: 0 }} />}
                    <span style={{
                      color: isActive ? cfg.color : (isH1 ? '#d4d4d4' : isH2 ? '#aaa' : '#888'),
                      fontSize: isH1 ? 11 : isH2 ? 10.5 : 10,
                      fontWeight: isH1 ? 700 : isH2 ? 600 : 400,
                      lineHeight: 1.4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {item.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Page Area ── */}
        <div
          ref={pageAreaRef}
          style={{ flex: 1, overflow: 'auto', padding: '28px 20px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', background: '#525659' }}
        >
          <div style={{
            width: `${zoom}%`, maxWidth: 860, minWidth: 460,
            background: 'white', boxShadow: '0 6px 32px rgba(0,0,0,0.55)',
            padding: '0 0 80px 0', borderRadius: 2,
            transition: 'width 0.2s ease', position: 'relative', overflow: 'hidden',
          }}>
            {/* Colored accent top stripe */}
            <div style={{ height: 5, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.accent})`, marginBottom: 0 }} />

            {/* Document header */}
            <div style={{ padding: '32px 72px 24px', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, background: cfg.bg, border: `2px solid ${cfg.color}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={14} color={cfg.color} />
                </div>
                <span style={{ color: cfg.color, fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase' }}>{cfg.label}</span>
              </div>
              <div style={{ color: '#888', fontSize: 11 }}>Repository: <strong style={{ color: '#555' }}>{repo}</strong></div>
            </div>

            {/* Markdown content */}
            <div style={{ padding: '40px 72px', fontFamily: '"Georgia", "Times New Roman", serif', lineHeight: 1.75, color: '#1a1a1a' }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: makeHeading('h1', { fontSize: '1.85rem', fontWeight: 800, color: '#111827', borderBottom: `3px solid ${cfg.color}`, paddingBottom: 10, marginBottom: 20, marginTop: 36, fontFamily: '"Georgia", serif', lineHeight: 1.3 }),
                  h2: makeHeading('h2', { fontSize: '1.35rem', fontWeight: 700, color: cfg.accent, marginTop: 32, marginBottom: 12, fontFamily: '"Georgia", serif', paddingLeft: 12, borderLeft: `4px solid ${cfg.color}` }),
                  h3: makeHeading('h3', { fontSize: '1.05rem', fontWeight: 700, color: '#374151', marginTop: 24, marginBottom: 8, fontFamily: '"Georgia", serif' }),
                  p: ({ children }) => (
                    <p style={{ fontSize: '0.94rem', lineHeight: 1.85, color: '#374151', marginBottom: 16, fontFamily: '"Georgia", serif' }}>
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => <ul style={{ paddingLeft: 24, marginBottom: 16 }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ paddingLeft: 24, marginBottom: 16 }}>{children}</ol>,
                  li: ({ children }) => (
                    <li style={{ fontSize: '0.94rem', lineHeight: 1.8, color: '#374151', marginBottom: 6 }}>{children}</li>
                  ),
                  strong: ({ children }) => <strong style={{ color: '#111827', fontWeight: 700 }}>{children}</strong>,
                  em: ({ children }) => <em style={{ color: '#555', fontStyle: 'italic' }}>{children}</em>,
                  code: ({ inline, children }) => inline ? (
                    <code style={{ background: cfg.bg, color: cfg.accent, padding: '1px 6px', borderRadius: 4, fontSize: '0.83em', fontFamily: 'Consolas, "Courier New", monospace', border: `1px solid ${cfg.color}22` }}>
                      {children}
                    </code>
                  ) : (
                    <pre style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '16px 20px', borderRadius: 8, overflow: 'auto', fontFamily: 'Consolas, "Courier New", monospace', fontSize: '0.82rem', lineHeight: 1.65, marginBottom: 20, borderLeft: `4px solid ${cfg.color}` }}>
                      <code style={{ fontFamily: 'inherit' }}>{children}</code>
                    </pre>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote style={{ borderLeft: `4px solid ${cfg.color}`, paddingLeft: 18, marginLeft: 0, marginBottom: 16, background: cfg.bg, padding: '12px 18px', borderRadius: '0 8px 8px 0' }}>
                      {children}
                    </blockquote>
                  ),
                  table: ({ children }) => (
                    <div style={{ overflowX: 'auto', marginBottom: 24, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => <thead style={{ background: cfg.color }}>{children}</thead>,
                  th: ({ children }) => (
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.82rem', color: 'white', letterSpacing: 0.5 }}>{children}</th>
                  ),
                  td: ({ children }) => (
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid #f0f0f0', color: '#374151', fontSize: '0.88rem' }}>{children}</td>
                  ),
                  tr: ({ children, ...props }) => (
                    <tr style={{ transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = cfg.bg} onMouseLeave={e => e.currentTarget.style.background = ''} {...props}>{children}</tr>
                  ),
                  hr: () => <hr style={{ border: 'none', borderTop: `1px solid ${cfg.color}44`, margin: '28px 0' }} />,
                }}
              >
                {content || '*Loading document...*'}
              </ReactMarkdown>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 72px', borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#bbb', fontSize: 10, fontFamily: 'Consolas, monospace' }}>AURA Intelligence Engine · {repo}</span>
              <span style={{ color: cfg.color, fontSize: 10, fontWeight: 700 }}>{cfg.label.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
