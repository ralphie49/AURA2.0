import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import axios from 'axios';
import {
  Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Maximize2, Minimize2, ZoomIn, ZoomOut, RefreshCw, X, Info,
  ArrowRight, Cpu, Layers,
} from 'lucide-react';

const DependencyGraph = ({
  repo,
  graphData: externalData,
  highlightNodes: externalHighlight,
  isMaximized,
  onToggleMaximize,
  isDarkMode = true,
}) => {
  const [data, setData] = useState({ nodes: [], links: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMsg, setSearchMsg] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedLink, setSelectedLink] = useState(null);
  const [linkExplanation, setLinkExplanation] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [hoverNode, setHoverNode] = useState(null);
  const [hoverLink, setHoverLink] = useState(null);
  const [localHighlight, setLocalHighlight] = useState(new Set());
  const graphRef = useRef();

  // Merge external highlights with local ones
  const highlightNodes = useMemo(() => {
    const merged = new Set([...(externalHighlight || []), ...localHighlight]);
    return merged;
  }, [externalHighlight, localHighlight]);

  // Load graph data
  useEffect(() => {
    if (externalData && externalData.nodes?.length > 0) {
      setData(externalData);
    } else if (repo) {
      axios.get(`http://localhost:8000/api/graph/${repo}`)
        .then(res => setData(res.data))
        .catch(() => {});
    }
  }, [repo, externalData]);

  // Auto-fit on load
  useEffect(() => {
    if (data.nodes.length > 0) {
      setTimeout(() => graphRef.current?.zoomToFit(600, 48), 800);
    }
  }, [data]);

  // Neighbor map for hover highlighting
  const neighbors = useMemo(() => {
    const map = new Map();
    (data.links || []).forEach(link => {
      const src = String(typeof link.source === 'object' ? link.source.id : link.source);
      const tgt = String(typeof link.target === 'object' ? link.target.id : link.target);
      if (!map.has(src)) map.set(src, new Set());
      if (!map.has(tgt)) map.set(tgt, new Set());
      map.get(src).add(tgt);
      map.get(tgt).add(src);
    });
    return map;
  }, [data]);

  const matchHighlight = useCallback((id, name) => {
    const idLow = String(id || '').replace(/\\/g, '/').toLowerCase();
    const nameLow = String(name || '').toLowerCase();
    return Array.from(highlightNodes).some(f =>
      idLow === f || idLow.endsWith('/' + f) || nameLow === f
    );
  }, [highlightNodes]);

  const handleSearch = useCallback(() => {
    if (!searchTerm.trim()) return;
    const found = data.nodes.find(n =>
      String(n.name || n.id || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (found && graphRef.current) {
      graphRef.current.centerAt(found.x, found.y, 700);
      graphRef.current.zoom(4, 700);
      setLocalHighlight(new Set([String(found.id)]));
      setSearchMsg(`Found: ${String(found.name || found.id).split('/').pop()}`);
    } else {
      setSearchMsg('No match found');
      setTimeout(() => setSearchMsg(''), 2000);
    }
  }, [searchTerm, data.nodes]);

  const clearSearch = () => {
    setSearchTerm('');
    setSearchMsg('');
    setLocalHighlight(new Set());
  };

  const pan = (dir) => {
    if (!graphRef.current) return;
    const cc = graphRef.current.centerAt();
    const step = 80;
    const moves = { up: [0, -step], down: [0, step], left: [-step, 0], right: [step, 0] };
    const [dx, dy] = moves[dir] || [0, 0];
    graphRef.current.centerAt((cc?.x ?? 0) + dx, (cc?.y ?? 0) + dy, 280);
  };

  const adjustZoom = (factor) => {
    if (!graphRef.current) return;
    graphRef.current.zoom(graphRef.current.zoom() * factor, 260);
  };

  // ── Stream AI explanation for an edge ──
  const explainLink = useCallback(async (srcNode, tgtNode) => {
    if (!repo) return;
    setLinkExplanation('');
    setLinkLoading(true);
    const srcName = String(srcNode?.id || srcNode?.name || '');
    const tgtName = String(tgtNode?.id || tgtNode?.name || '');
    const question = `Explain the dependency between "${srcName}" and "${tgtName}" in this codebase. What does "${srcName.split('/').pop()}" import or use from "${tgtName.split('/').pop()}"? Why does this dependency exist and what would break if it were removed? Keep the answer concise and focused.`;
    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_name: repo, question }),
      });
      if (!response.ok) throw new Error('Stream failed');
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setLinkExplanation(accumulated);
      }
    } catch {
      setLinkExplanation('Could not fetch explanation. Make sure the backend is running.');
    } finally {
      setLinkLoading(false);
    }
  }, [repo]);

  // ── Directory-based color palette ──
  const PALETTE = [
    '#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6',
    '#06b6d4', '#84cc16', '#f97316', '#a855f7', '#14b8a6',
    '#fb923c', '#e879f9',
  ];
  const getBaseColor = useCallback((node) => {
    const group = String(node.id || node.name || '').replace(/\\/g, '/').split('/')[0] || 'root';
    let hash = 0;
    for (let i = 0; i < group.length; i++) hash = ((hash << 5) - hash + group.charCodeAt(i)) & 0x7fffffff;
    return PALETTE[hash % PALETTE.length];
  }, []);

  // ── Node color ──
  const getNodeColor = useCallback((node) => {
    const id = String(node.id || '');
    const isHighlighted = matchHighlight(id, node.name);
    const isHovered = hoverNode?.id === node.id;
    const isSelected = selectedNode?.id === node.id;
    const isNeighbor = hoverNode && neighbors.get(String(hoverNode.id))?.has(id);

    if (isSelected) return '#a78bfa';
    if (isHovered) return '#f59e0b';
    if (isHighlighted) return '#ef4444';
    if (isNeighbor) return '#fbbf24';
    if (highlightNodes.size > 0 || hoverNode) return isDarkMode ? '#1e3a5f' : '#cbd5e1';
    return getBaseColor(node);
  }, [matchHighlight, hoverNode, selectedNode, neighbors, highlightNodes, isDarkMode, getBaseColor]);

  // ── Link color ──
  const getLinkColor = useCallback((link) => {
    const src = typeof link.source === 'object' ? link.source.id : link.source;
    const tgt = typeof link.target === 'object' ? link.target.id : link.target;
    const isNodeHoverLink = hoverNode && (src === hoverNode.id || tgt === hoverNode.id);
    const isLinkHovered = hoverLink === link;
    const isHighlightLink = matchHighlight(src, '') || matchHighlight(tgt, '');

    if (isLinkHovered) return '#a78bfa';
    if (isNodeHoverLink) return '#f59e0b';
    if (isHighlightLink) return 'rgba(239,68,68,0.65)';
    if (highlightNodes.size > 0 || hoverNode) return isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
    return isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
  }, [matchHighlight, hoverNode, hoverLink, highlightNodes, isDarkMode]);

  // ── Node canvas (label rendering) ──
  const nodeCanvasObject = useCallback((node, ctx, gs) => {
    const id = String(node.id || '');
    const isHighlighted = matchHighlight(id, node.name);
    const isHovered = hoverNode?.id === node.id;
    const isSelected = selectedNode?.id === node.id;
    const isNeighbor = hoverNode && neighbors.get(String(hoverNode.id))?.has(id);
    const isVisible = isHighlighted || isHovered || isSelected || isNeighbor || gs > 1.8;

    if (isHovered || isSelected || isHighlighted) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 10, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? 'rgba(167,139,250,0.25)' : isHighlighted ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)';
      ctx.fill();
    }

    if (isVisible) {
      const label = String(node.name || node.id || '').split('/').pop();
      const fs = Math.max(7, 11 / gs);
      ctx.font = `bold ${fs}px Inter, sans-serif`;
      const tw = ctx.measureText(label).width;
      const pad = fs * 0.35;

      ctx.fillStyle = isDarkMode ? 'rgba(13,17,23,0.88)' : 'rgba(255,255,255,0.92)';
      const bx = node.x - tw / 2 - pad, by = node.y + 8, bw = tw + pad * 2, bh = fs + pad * 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 3);
      else ctx.rect(bx, by, bw, bh);
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isSelected ? '#a78bfa' : isHovered ? '#f59e0b' : isHighlighted ? '#ef4444' : isNeighbor ? '#fbbf24' : (isDarkMode ? '#94a3b8' : '#475569');
      ctx.fillText(label, node.x, node.y + 8 + pad * 0.5);
    }
  }, [matchHighlight, hoverNode, selectedNode, neighbors, isDarkMode]);

  // ── Styles ──
  const panelBg = isDarkMode ? 'rgba(13,17,23,0.96)' : 'rgba(255,255,255,0.97)';
  const panelBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const muted = isDarkMode ? '#6e7681' : '#94a3b8';
  const textColor = isDarkMode ? '#c9d1d9' : '#1e293b';
  const sideBg = isDarkMode ? '#0d1117' : '#ffffff';
  const sideBorder = isDarkMode ? '#21262d' : '#e2e8f0';

  const iconBtn = (active = false) => ({
    width: 30, height: 30,
    background: active ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
    border: `1px solid ${panelBorder}`,
    borderRadius: 7, cursor: 'pointer', color: active ? '#3b82f6' : muted,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
  });

  const closeSidePanel = () => {
    setSelectedLink(null);
    setSelectedNode(null);
    setLinkExplanation('');
  };

  const srcName = selectedLink ? String(selectedLink.source?.name || selectedLink.source?.id || '').split('/').pop() : '';
  const tgtName = selectedLink ? String(selectedLink.target?.name || selectedLink.target?.id || '').split('/').pop() : '';
  const sidePanelOpen = !!(selectedLink || selectedNode);

  return (
    <div style={{ height: '100%', display: 'flex', background: isDarkMode ? '#0d1117' : '#f1f5f9', overflow: 'hidden' }}>

      {/* ── Graph canvas ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <ForceGraph2D
          ref={graphRef}
          graphData={data}
          backgroundColor="transparent"
          nodeRelSize={5}
          nodeColor={getNodeColor}
          linkColor={getLinkColor}
          nodeCanvasObjectMode={() => 'after'}
          nodeCanvasObject={nodeCanvasObject}
          onNodeHover={node => { setHoverNode(node); if (node) setHoverLink(null); }}
          onNodeClick={node => {
            setSelectedNode(prev => prev?.id === node.id ? null : node);
            setSelectedLink(null);
            setLinkExplanation('');
          }}
          onLinkHover={link => setHoverLink(link || null)}
          onLinkClick={link => {
            const src = typeof link.source === 'object' ? link.source : data.nodes.find(n => n.id === link.source);
            const tgt = typeof link.target === 'object' ? link.target : data.nodes.find(n => n.id === link.target);
            setSelectedLink({ source: src, target: tgt });
            setSelectedNode(null);
            explainLink(src, tgt);
          }}
          linkWidth={link => hoverLink === link ? 3 : (hoverNode && (
            (typeof link.source === 'object' ? link.source.id : link.source) === hoverNode.id ||
            (typeof link.target === 'object' ? link.target.id : link.target) === hoverNode.id
          )) ? 2.5 : 1}
          cooldownTicks={120}
          onEngineStop={() => graphRef.current?.zoomToFit(500, 48)}
        />

        {/* ── Search + Nav panel (top-left) ── */}
        <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 10 }}>
          <div style={{ background: panelBg, backdropFilter: 'blur(14px)', borderRadius: 10, border: `1px solid ${panelBorder}`, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: 6 }}>
              <Search size={13} color={muted} />
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search node..."
                style={{ background: 'none', border: 'none', outline: 'none', color: textColor, fontSize: 12, width: 140 }}
              />
              {searchTerm && (
                <button onClick={clearSearch} style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted, display: 'flex' }}>
                  <X size={11} />
                </button>
              )}
              <button
                onClick={handleSearch}
                style={{ background: '#3b82f6', border: 'none', cursor: 'pointer', color: 'white', borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}
              >Go</button>
            </div>
            {searchMsg && (
              <div style={{ padding: '3px 10px 7px', borderTop: `1px solid ${panelBorder}` }}>
                <span style={{ color: searchMsg.startsWith('Found') ? '#22c55e' : '#ef4444', fontSize: 10, fontWeight: 600 }}>
                  {searchMsg}
                </span>
              </div>
            )}
          </div>

          <div style={{ background: panelBg, backdropFilter: 'blur(14px)', borderRadius: 10, border: `1px solid ${panelBorder}`, padding: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 30px)', gap: 3, marginBottom: 3 }}>
              <div />
              <button style={iconBtn()} onClick={() => pan('up')} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; e.currentTarget.style.color = '#3b82f6'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = muted; }}><ChevronUp size={14} /></button>
              <div />
              <button style={iconBtn()} onClick={() => pan('left')} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; e.currentTarget.style.color = '#3b82f6'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = muted; }}><ChevronLeft size={14} /></button>
              <button style={iconBtn()} onClick={() => graphRef.current?.zoomToFit(500, 48)} title="Fit" onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; e.currentTarget.style.color = '#3b82f6'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = muted; }}><RefreshCw size={12} /></button>
              <button style={iconBtn()} onClick={() => pan('right')} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; e.currentTarget.style.color = '#3b82f6'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = muted; }}><ChevronRight size={14} /></button>
              <div />
              <button style={iconBtn()} onClick={() => pan('down')} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; e.currentTarget.style.color = '#3b82f6'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = muted; }}><ChevronDown size={14} /></button>
              <div />
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              <button style={{ ...iconBtn(), flex: 1 }} onClick={() => adjustZoom(0.7)} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; e.currentTarget.style.color = '#3b82f6'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = muted; }}><ZoomOut size={13} /></button>
              <button style={{ ...iconBtn(), flex: 1 }} onClick={() => adjustZoom(1.45)} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; e.currentTarget.style.color = '#3b82f6'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = muted; }}><ZoomIn size={13} /></button>
            </div>
          </div>
        </div>

        {/* ── Top-right: stats + maximize ── */}
        <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ background: panelBg, backdropFilter: 'blur(14px)', border: `1px solid ${panelBorder}`, borderRadius: 8, padding: '6px 14px', display: 'flex', gap: 14 }}>
            <span style={{ color: '#3b82f6', fontSize: 11, fontWeight: 700 }}>{data.nodes.length} nodes</span>
            <span style={{ color: muted, fontSize: 11 }}>{data.links.length} edges</span>
          </div>
          {onToggleMaximize && (
            <button
              onClick={onToggleMaximize}
              title={isMaximized ? 'Restore' : 'Fullscreen'}
              style={{ background: panelBg, backdropFilter: 'blur(14px)', border: `1px solid ${panelBorder}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: muted, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = panelBorder; e.currentTarget.style.color = muted; }}
            >
              {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span>{isMaximized ? 'Restore' : 'Fullscreen'}</span>
            </button>
          )}
        </div>

        {/* ── Legend (bottom-right) ── */}
        <div style={{ position: 'absolute', bottom: 20, right: 14, zIndex: 10, background: panelBg, backdropFilter: 'blur(14px)', border: `1px solid ${panelBorder}`, borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {PALETTE.slice(0, 6).map(c => (
                <div key={c} style={{ width: 7, height: 7, background: c, borderRadius: '50%' }} />
              ))}
            </div>
            <span style={{ color: muted, fontSize: 10 }}>By directory</span>
          </div>
          {[
            { color: '#ef4444', label: 'Highlighted' },
            { color: '#f59e0b', label: 'Hovered' },
            { color: '#a78bfa', label: 'Selected' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <div style={{ width: 7, height: 7, background: color, borderRadius: '50%' }} />
              <span style={{ color: muted, fontSize: 10 }}>{label}</span>
            </div>
          ))}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${panelBorder}`, color: muted, fontSize: 9, letterSpacing: 0.5, opacity: 0.7 }}>
            Click edge for AI analysis
          </div>
        </div>

        {/* Empty state */}
        {data.nodes.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ textAlign: 'center', color: muted }}>
              <Info size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.6 }}>No graph data available</div>
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.4 }}>Analyze a repository to visualize dependencies</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Right side panel: edge explanation or node info ── */}
      {sidePanelOpen && (
        <div style={{
          width: 320, flexShrink: 0,
          background: sideBg,
          borderLeft: `1px solid ${sideBorder}`,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Panel header */}
          <div style={{
            padding: '14px 16px', borderBottom: `1px solid ${sideBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: selectedLink ? 'linear-gradient(135deg, #3b82f6, #a78bfa)' : 'linear-gradient(135deg, #f59e0b, #f97316)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {selectedLink ? <ArrowRight size={13} color="white" /> : <Layers size={13} color="white" />}
              </div>
              <div>
                <div style={{ color: textColor, fontSize: 12, fontWeight: 700 }}>
                  {selectedLink ? 'Dependency Analysis' : 'Module Info'}
                </div>
                <div style={{ color: muted, fontSize: 10, marginTop: 1 }}>
                  {selectedLink ? 'AI-powered connection insight' : 'Node details'}
                </div>
              </div>
            </div>
            <button
              onClick={closeSidePanel}
              style={{ background: 'none', border: `1px solid ${sideBorder}`, borderRadius: 6, cursor: 'pointer', color: muted, display: 'flex', padding: 4, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = sideBorder; e.currentTarget.style.color = muted; }}
            >
              <X size={13} />
            </button>
          </div>

          {/* ── Edge panel content ── */}
          {selectedLink && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Source → Target visual */}
              <div style={{ background: isDarkMode ? '#161b22' : '#f8fafc', borderRadius: 12, padding: 14, border: `1px solid ${sideBorder}` }}>
                {/* Source */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))',
                    border: '1.5px solid rgba(59,130,246,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 14 }}>📄</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#60a5fa', fontSize: 12, fontWeight: 700, fontFamily: 'Consolas, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {srcName}
                    </div>
                    <div style={{ color: muted, fontSize: 10, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedLink.source?.id}
                    </div>
                  </div>
                </div>

                {/* Arrow connector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 17, marginBottom: 10 }}>
                  <div style={{ width: 2, height: 18, background: 'linear-gradient(180deg, #3b82f6, #a78bfa)', borderRadius: 1 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: isDarkMode ? 'rgba(167,139,250,0.1)' : 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 20, padding: '3px 10px' }}>
                    <ArrowRight size={10} color="#a78bfa" />
                    <span style={{ color: '#a78bfa', fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>imports</span>
                  </div>
                </div>

                {/* Target */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(167,139,250,0.05))',
                    border: '1.5px solid rgba(167,139,250,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 14 }}>📦</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#a78bfa', fontSize: 12, fontWeight: 700, fontFamily: 'Consolas, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tgtName}
                    </div>
                    <div style={{ color: muted, fontSize: 10, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedLink.target?.id}
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Explanation */}
              <div style={{ background: isDarkMode ? '#161b22' : '#f8fafc', borderRadius: 12, border: `1px solid ${sideBorder}`, overflow: 'hidden', flex: 1 }}>
                <div style={{ padding: '10px 14px', borderBottom: `1px solid ${sideBorder}`, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Cpu size={11} color="white" />
                  </div>
                  <span style={{ color: textColor, fontSize: 11, fontWeight: 700 }}>AURA Explanation</span>
                  {linkLoading && (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#3b82f6', opacity: 0.7, animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ padding: '14px', fontSize: 12, lineHeight: 1.75, color: textColor, whiteSpace: 'pre-wrap', minHeight: 80 }}>
                  {linkExplanation || (
                    <span style={{ color: muted, fontStyle: 'italic' }}>
                      {linkLoading ? 'Analyzing connection...' : 'Click an edge to analyze it.'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Node panel content ── */}
          {selectedNode && !selectedLink && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: isDarkMode ? '#161b22' : '#f8fafc', borderRadius: 12, padding: 14, border: `1px solid ${sideBorder}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${getBaseColor(selectedNode)}22`, border: `2px solid ${getBaseColor(selectedNode)}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 18 }}>📄</span>
                  </div>
                  <div>
                    <div style={{ color: textColor, fontSize: 13, fontWeight: 700, fontFamily: 'Consolas, monospace' }}>
                      {String(selectedNode.name || selectedNode.id).split('/').pop()}
                    </div>
                    <div style={{ color: muted, fontSize: 10, marginTop: 2 }}>Module</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ color: muted, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 }}>Full Path</div>
                    <div style={{ color: textColor, fontSize: 11, fontFamily: 'Consolas, monospace', wordBreak: 'break-all', lineHeight: 1.5 }}>{selectedNode.id}</div>
                  </div>
                  <div style={{ background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ color: muted, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2 }}>Connections</div>
                    <div style={{ color: '#3b82f6', fontSize: 18, fontWeight: 800 }}>
                      {neighbors.get(String(selectedNode.id))?.size || 0}
                      <span style={{ color: muted, fontSize: 10, fontWeight: 400, marginLeft: 4 }}>modules</span>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ padding: '10px 14px', background: isDarkMode ? '#161b22' : '#f8fafc', borderRadius: 10, border: `1px solid ${sideBorder}` }}>
                <p style={{ color: muted, fontSize: 11, lineHeight: 1.6, margin: 0 }}>
                  Click an <strong style={{ color: textColor }}>edge</strong> connecting this node to another to get an AI-powered explanation of their dependency relationship.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
};

export default DependencyGraph;
