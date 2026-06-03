/**
 * Knowledge Graph Viewer Component
 * Interactive visualization of entities and relationships extracted from documents.
 *
 * Chrome reskinned onto the Coral Cockpit --pulse-* tokens (WA-3 of
 * docs/WAR_ROOM_STUDIO_RESKIN_HANDOFF_2026-06-02.md): tinted-neutral surfaces,
 * coral-as-signal for active state, Lucide icons, GEMINI provenance tag. The
 * force-directed CANVAS (node/edge render + the ENTITY_COLORS categorical
 * palette) is a data-viz surface and is preserved as-is; only the surrounding
 * chrome (header, legend, search, zoom, sidebar, NodeDetails) was reskinned.
 * (Canvas dark bg / theme-awareness is a deferred polish item.)
 *
 * UX: graph build is now gated behind an explicit "Generate" CTA instead of
 * auto-running on mount. The old auto-run guarded on `apiKey` (the deprecated
 * no-op '' — buildKnowledgeGraph ignores it and routes via ai-router), so it
 * never fired; the panel sat on a misleading static "Analyzing documents..."
 * subtitle with an empty body. The CTA fixes both.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  GraphFilter,
  EntityType,
  ENTITY_COLORS,
} from '../../../types/advancedAI';
import { buildKnowledgeGraph } from '../../../services/advancedAIService';
import { KnowledgeDoc } from '../../../services/ragService';
import { VoiceTextButton } from '../../shared/VoiceTextButton';
import { ProvenanceTag } from '../ProvenanceTag';

import { AlertTriangle, Columns, FileText, GitFork, List, Minus, MousePointer, Plus, Search, X } from 'lucide-react';

interface KnowledgeGraphViewerProps {
  documents: KnowledgeDoc[];
  apiKey: string;
  onClose?: () => void;
}

export const KnowledgeGraphViewer: React.FC<KnowledgeGraphViewerProps> = ({
  documents,
  apiKey,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  // View state
  const [filter, setFilter] = useState<GraphFilter>({});
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showLegend, setShowLegend] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);

  // Animation state
  const animationRef = useRef<number>();
  const nodesRef = useRef<Map<string, { x: number; y: number; vx: number; vy: number }>>(new Map());

  const buildGraph = async () => {
    setLoading(true);
    setError(null);
    setProgress(0);
    setStatus('Starting extraction...');

    try {
      const knowledgeGraph = await buildKnowledgeGraph(
        documents,
        apiKey,
        (p, s) => {
          setProgress(p);
          setStatus(s);
        }
      );
      setGraph(knowledgeGraph);
      initializeNodePositions(knowledgeGraph.nodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build knowledge graph');
    } finally {
      setLoading(false);
    }
  };

  const initializeNodePositions = (nodes: GraphNode[]) => {
    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;

    nodesRef.current.clear();
    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      const radius = Math.min(width, height) * 0.3;
      nodesRef.current.set(node.id, {
        x: width / 2 + Math.cos(angle) * radius * (0.5 + Math.random() * 0.5),
        y: height / 2 + Math.sin(angle) * radius * (0.5 + Math.random() * 0.5),
        vx: 0,
        vy: 0,
      });
    });
  };

  // Filter nodes based on current filter
  const filteredNodes = useMemo(() => {
    if (!graph) return [];
    let nodes = graph.nodes;

    if (filter.entityTypes && filter.entityTypes.length > 0) {
      nodes = nodes.filter(n => filter.entityTypes!.includes(n.type));
    }

    if (filter.minImportance !== undefined) {
      nodes = nodes.filter(n => n.importance >= filter.minImportance!);
    }

    if (filter.docIds && filter.docIds.length > 0) {
      nodes = nodes.filter(n => n.doc_sources.some(d => filter.docIds!.includes(d)));
    }

    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      nodes = nodes.filter(n => n.label.toLowerCase().includes(query));
    }

    return nodes;
  }, [graph, filter]);

  // Filter edges to only show connections between visible nodes
  const filteredEdges = useMemo(() => {
    if (!graph) return [];
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    return graph.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
  }, [graph, filteredNodes]);

  // Force simulation
  useEffect(() => {
    if (!graph || filteredNodes.length === 0) return;

    const simulate = () => {
      const width = containerRef.current?.clientWidth || 800;
      const height = containerRef.current?.clientHeight || 600;

      // Apply forces
      filteredNodes.forEach(node => {
        const pos = nodesRef.current.get(node.id);
        if (!pos) return;

        // Center gravity
        pos.vx += (width / 2 - pos.x) * 0.001;
        pos.vy += (height / 2 - pos.y) * 0.001;

        // Repulsion from other nodes
        filteredNodes.forEach(other => {
          if (other.id === node.id) return;
          const otherPos = nodesRef.current.get(other.id);
          if (!otherPos) return;

          const dx = pos.x - otherPos.x;
          const dy = pos.y - otherPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 1000 / (dist * dist);

          pos.vx += (dx / dist) * force;
          pos.vy += (dy / dist) * force;
        });
      });

      // Edge attraction
      filteredEdges.forEach(edge => {
        const sourcePos = nodesRef.current.get(edge.source);
        const targetPos = nodesRef.current.get(edge.target);
        if (!sourcePos || !targetPos) return;

        const dx = targetPos.x - sourcePos.x;
        const dy = targetPos.y - sourcePos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 150) * 0.01 * edge.weight;

        sourcePos.vx += (dx / dist) * force;
        sourcePos.vy += (dy / dist) * force;
        targetPos.vx -= (dx / dist) * force;
        targetPos.vy -= (dy / dist) * force;
      });

      // Apply velocity and damping
      filteredNodes.forEach(node => {
        const pos = nodesRef.current.get(node.id);
        if (!pos) return;

        pos.vx *= 0.9;
        pos.vy *= 0.9;
        pos.x += pos.vx;
        pos.y += pos.vy;

        // Boundary constraints
        pos.x = Math.max(50, Math.min(width - 50, pos.x));
        pos.y = Math.max(50, Math.min(height - 50, pos.y));
      });

      renderGraph();
      animationRef.current = requestAnimationFrame(simulate);
    };

    simulate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [graph, filteredNodes, filteredEdges]);

  const renderGraph = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear (data-viz canvas — intentionally dark; see file header)
    ctx.fillStyle = '#0f1115';
    ctx.fillRect(0, 0, width, height);

    // Apply transform
    ctx.save();
    ctx.translate(pan.x + width / 2, pan.y + height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-width / 2, -height / 2);

    // Draw edges
    filteredEdges.forEach(edge => {
      const sourcePos = nodesRef.current.get(edge.source);
      const targetPos = nodesRef.current.get(edge.target);
      if (!sourcePos || !targetPos) return;

      ctx.beginPath();
      ctx.moveTo(sourcePos.x, sourcePos.y);
      ctx.lineTo(targetPos.x, targetPos.y);
      ctx.strokeStyle = `rgba(100, 116, 139, ${0.2 + edge.weight * 0.3})`;
      ctx.lineWidth = 1 + edge.weight * 2;
      ctx.stroke();

      // Draw relationship label for hovered or selected edges
      if (
        (hoveredNode && (edge.source === hoveredNode.id || edge.target === hoveredNode.id)) ||
        (selectedNode && (edge.source === selectedNode.id || edge.target === selectedNode.id))
      ) {
        const midX = (sourcePos.x + targetPos.x) / 2;
        const midY = (sourcePos.y + targetPos.y) / 2;
        ctx.font = '10px Inter';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.fillText(edge.relationship, midX, midY - 5);
      }
    });

    // Draw nodes
    filteredNodes.forEach(node => {
      const pos = nodesRef.current.get(node.id);
      if (!pos) return;

      const isHovered = hoveredNode?.id === node.id;
      const isSelected = selectedNode?.id === node.id;
      const isConnected =
        selectedNode &&
        filteredEdges.some(
          e =>
            (e.source === selectedNode.id && e.target === node.id) ||
            (e.target === selectedNode.id && e.source === node.id)
        );

      const size = node.size || 15;
      const alpha = selectedNode && !isSelected && !isConnected ? 0.3 : 1;

      // Glow effect for selected/hovered
      if (isSelected || isHovered) {
        const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, size * 2);
        gradient.addColorStop(0, node.color + '40');
        gradient.addColorStop(1, node.color + '00');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      ctx.fillStyle = node.color + (alpha < 1 ? '4d' : '');
      ctx.fill();

      if (isSelected || isHovered) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Label
      ctx.font = `${isSelected || isHovered ? 'bold ' : ''}12px Inter`;
      ctx.fillStyle = alpha < 1 ? '#64748b80' : '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(node.label, pos.x, pos.y + size + 4);
    });

    ctx.restore();
  }, [filteredNodes, filteredEdges, hoveredNode, selectedNode, zoom, pan]);

  // Mouse interaction
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const width = canvas.width;
      const height = canvas.height;

      // Transform mouse coordinates
      const mouseX = ((e.clientX - rect.left - pan.x - width / 2) / zoom + width / 2);
      const mouseY = ((e.clientY - rect.top - pan.y - height / 2) / zoom + height / 2);

      // Find clicked node
      let clicked: GraphNode | null = null;
      for (const node of filteredNodes) {
        const pos = nodesRef.current.get(node.id);
        if (!pos) continue;

        const dist = Math.sqrt((pos.x - mouseX) ** 2 + (pos.y - mouseY) ** 2);
        if (dist <= (node.size || 15)) {
          clicked = node;
          break;
        }
      }

      setSelectedNode(clicked);
    },
    [filteredNodes, zoom, pan]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const width = canvas.width;
      const height = canvas.height;

      const mouseX = ((e.clientX - rect.left - pan.x - width / 2) / zoom + width / 2);
      const mouseY = ((e.clientY - rect.top - pan.y - height / 2) / zoom + height / 2);

      let hovered: GraphNode | null = null;
      for (const node of filteredNodes) {
        const pos = nodesRef.current.get(node.id);
        if (!pos) continue;

        const dist = Math.sqrt((pos.x - mouseX) ** 2 + (pos.y - mouseY) ** 2);
        if (dist <= (node.size || 15)) {
          hovered = node;
          break;
        }
      }

      setHoveredNode(hovered);
    },
    [filteredNodes, zoom, pan]
  );

  // Resize canvas
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      renderGraph();
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [renderGraph]);

  // Entity type toggle
  const toggleEntityType = (type: EntityType) => {
    setFilter(prev => {
      const types = prev.entityTypes || Object.keys(ENTITY_COLORS) as EntityType[];
      if (types.includes(type)) {
        return { ...prev, entityTypes: types.filter(t => t !== type) };
      } else {
        return { ...prev, entityTypes: [...types, type] };
      }
    });
  };

  const entityTypes = Object.keys(ENTITY_COLORS) as EntityType[];
  const activeTypes = filter.entityTypes || entityTypes;

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64" style={{ color: 'var(--pulse-ink-3)' }}>
        <GitFork size={40} className="mb-4 opacity-50" />
        <p>Select documents to build a knowledge graph</p>
      </div>
    );
  }

  const headerBtn = (active: boolean): React.CSSProperties =>
    active
      ? { background: 'var(--pulse-coral-bg-12)', color: 'var(--pulse-coral-fg)' }
      : { color: 'var(--pulse-ink-3)' };

  return (
    <div className="h-full flex flex-col rounded-lg overflow-hidden" style={{ background: 'var(--pulse-surface-modal, var(--pulse-canvas))' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--pulse-border)' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg flex items-center justify-center" style={{ background: 'var(--pulse-coral-bg-12)', color: 'var(--pulse-coral-fg)' }}>
            <GitFork size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--pulse-ink)' }}>Knowledge Graph</h2>
              {graph && <ProvenanceTag model="GEMINI" kind="KNOWLEDGE GRAPH" />}
            </div>
            <p className="text-sm" style={{ color: 'var(--pulse-ink-3)' }}>
              {graph
                ? `${filteredNodes.length} entities, ${filteredEdges.length} relationships`
                : `${documents.length} document${documents.length !== 1 ? 's' : ''} selected`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="p-2 rounded-lg transition-colors"
            style={headerBtn(showLegend)}
            title="Toggle legend"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 rounded-lg transition-colors"
            style={headerBtn(showSidebar)}
            title="Toggle sidebar"
          >
            <Columns size={16} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--pulse-ink-3)' }}
              aria-label="Close Knowledge Graph"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Intro / CTA — explicit generate (no auto-run) */}
      {!loading && !error && !graph && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="p-3 rounded-lg mb-4 flex items-center justify-center" style={{ background: 'var(--pulse-coral-bg-12)', color: 'var(--pulse-coral-fg)' }}>
            <GitFork size={24} />
          </div>
          <p className="mb-1" style={{ color: 'var(--pulse-ink)' }}>Map entities &amp; relationships</p>
          <p className="text-sm mb-5" style={{ color: 'var(--pulse-ink-3)' }}>Extract a graph of people, places, concepts, and how they connect across your {documents.length} document{documents.length !== 1 ? 's' : ''}.</p>
          <button onClick={buildGraph} className="war-room-btn-primary px-4 py-2 rounded-lg text-sm font-medium">
            Generate Graph
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="relative w-24 h-24 mb-6">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="48" cy="48" r="44" fill="none" stroke="var(--pulse-border-strong)" strokeWidth="8" />
              <circle
                cx="48" cy="48" r="44" fill="none"
                stroke="var(--pulse-rose)" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${progress * 2.76} 276`}
                className="transition-all duration-300"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold" style={{ color: 'var(--pulse-ink)' }}>{Math.round(progress)}%</span>
            </div>
          </div>
          <p style={{ color: 'var(--pulse-ink-3)' }}>{status}</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="p-4 rounded-full mb-4" style={{ background: 'rgba(239,68,68,0.12)' }}>
            <AlertTriangle size={28} style={{ color: '#ef4444' }} />
          </div>
          <p className="mb-4" style={{ color: '#ef4444' }}>{error}</p>
          <button
            onClick={buildGraph}
            className="px-4 py-2 rounded-lg transition-colors"
            style={{ background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink)' }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Graph View */}
      {graph && !loading && (
        <div className="flex-1 flex overflow-hidden">
          {/* Canvas Container */}
          <div ref={containerRef} className="flex-1 relative">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
              className="w-full h-full cursor-crosshair"
            />

            {/* Zoom controls */}
            <div className="absolute bottom-4 left-4 flex flex-col gap-2">
              <button
                onClick={() => setZoom(z => Math.min(3, z + 0.2))}
                className="p-2 rounded-lg"
                style={{ background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink-2)' }}
              >
                <Plus size={16} />
              </button>
              <button
                onClick={() => setZoom(1)}
                className="p-2 rounded-lg text-xs"
                style={{ background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink-2)' }}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => setZoom(z => Math.max(0.3, z - 0.2))}
                className="p-2 rounded-lg"
                style={{ background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink-2)' }}
              >
                <Minus size={16} />
              </button>
            </div>

            {/* Legend */}
            {showLegend && (
              <div className="absolute top-4 left-4 p-3 rounded-lg backdrop-blur-sm animate-fadeIn" style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}>
                <h4 className="mb-2" style={{ ...monoLabel, color: 'var(--pulse-ink-3)' }}>Entity Types</h4>
                <div className="grid grid-cols-2 gap-1">
                  {entityTypes.map(type => (
                    <button
                      key={type}
                      onClick={() => toggleEntityType(type)}
                      className="flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors"
                      style={activeTypes.includes(type)
                        ? { color: 'var(--pulse-ink)' }
                        : { color: 'var(--pulse-ink-3)', opacity: 0.6 }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ENTITY_COLORS[type] }} />
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search */}
            <div className="absolute top-4 right-4 w-72">
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={14} style={{ color: 'var(--pulse-ink-3)', position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Search entities..."
                    value={filter.searchQuery || ''}
                    onChange={e => setFilter(f => ({ ...f, searchQuery: e.target.value }))}
                    className="w-full pl-9 pr-4 py-2 rounded-lg focus:outline-none text-sm backdrop-blur-sm"
                    style={{ background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink)', border: '1px solid var(--pulse-border)' }}
                  />
                </div>
                <VoiceTextButton
                  onTranscript={(text) => setFilter(f => ({ ...f, searchQuery: (f.searchQuery || '') + text }))}
                  size="sm"
                  className="backdrop-blur-sm"
                />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          {showSidebar && (
            <div className="w-80 overflow-hidden animate-slideLeft" style={{ borderLeft: '1px solid var(--pulse-border)', background: 'var(--pulse-surface)' }}>
              <div className="h-full overflow-auto p-4">
                {selectedNode ? (
                  <NodeDetails
                    node={selectedNode}
                    edges={filteredEdges}
                    nodes={filteredNodes}
                    documents={documents}
                    onNodeSelect={setSelectedNode}
                  />
                ) : (
                  <div className="text-center py-8" style={{ color: 'var(--pulse-ink-3)' }}>
                    <MousePointer size={22} className="mb-2 opacity-50 mx-auto" />
                    <p className="text-sm">Click a node to see details</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const monoLabel: React.CSSProperties = {
  fontFamily: 'var(--pulse-font-mono)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

// Node Details Panel
interface NodeDetailsProps {
  node: GraphNode;
  edges: GraphEdge[];
  nodes: GraphNode[];
  documents: KnowledgeDoc[];
  onNodeSelect: (node: GraphNode) => void;
}

const NodeDetails: React.FC<NodeDetailsProps> = ({
  node,
  edges,
  nodes,
  documents,
  onNodeSelect,
}) => {
  const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id);
  const connectedNodes = connectedEdges
    .map(e => {
      const otherId = e.source === node.id ? e.target : e.source;
      return { edge: e, node: nodes.find(n => n.id === otherId)! };
    })
    .filter(cn => cn.node);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="p-3 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: node.color + '20' }}
        >
          {/* Entity type signalled by its categorical color (FA glyph removed). */}
          <span className="w-4 h-4 rounded-full" style={{ backgroundColor: node.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate" style={{ color: 'var(--pulse-ink)' }}>{node.label}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="px-2 py-0.5 rounded text-xs capitalize"
              style={{ backgroundColor: node.color + '20', color: node.color }}
            >
              {node.type}
            </span>
            <span className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
              {Math.round(node.importance * 100)}% importance
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg text-center" style={{ background: 'var(--pulse-surface-raised)' }}>
          <div className="text-lg font-bold" style={{ color: 'var(--pulse-ink)' }}>{node.mention_count}</div>
          <div className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>Mentions</div>
        </div>
        <div className="p-3 rounded-lg text-center" style={{ background: 'var(--pulse-surface-raised)' }}>
          <div className="text-lg font-bold" style={{ color: 'var(--pulse-ink)' }}>{connectedNodes.length}</div>
          <div className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>Connections</div>
        </div>
      </div>

      {/* Source Documents */}
      <div>
        <h4 className="mb-2" style={{ ...monoLabel, color: 'var(--pulse-ink-3)' }}>Source Documents</h4>
        <div className="space-y-1">
          {node.doc_sources.map(docId => {
            const doc = documents.find(d => d.id === docId);
            return (
              <div
                key={docId}
                className="flex items-center gap-2 p-2 rounded text-sm"
                style={{ background: 'var(--pulse-surface-raised)' }}
              >
                <FileText size={14} style={{ color: 'var(--pulse-ink-3)' }} />
                <span className="truncate" style={{ color: 'var(--pulse-ink-2)' }}>{doc?.title || docId}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connections */}
      {connectedNodes.length > 0 && (
        <div>
          <h4 className="mb-2" style={{ ...monoLabel, color: 'var(--pulse-ink-3)' }}>Relationships</h4>
          <div className="space-y-2">
            {connectedNodes.map(({ edge, node: connNode }) => (
              <button
                key={edge.id}
                onClick={() => onNodeSelect(connNode)}
                className="w-full flex items-center gap-3 p-2 rounded transition-colors text-left"
                style={{ background: 'var(--pulse-surface-raised)' }}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: connNode.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate" style={{ color: 'var(--pulse-ink)' }}>{connNode.label}</div>
                  <div className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
                    {edge.source === node.id ? '→' : '←'} {edge.relationship}
                  </div>
                </div>
                <span className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
                  {Math.round(edge.weight * 100)}%
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraphViewer;
