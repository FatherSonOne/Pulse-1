import React, { useState, useRef, useCallback } from 'react';
import { useWorkspace } from '../shared/WorkspaceContext';
import './AICanvas.css';

interface AICanvasProps {
  onBack: () => void;
  apiKey: string;
}

interface Node {
  id: string;
  type: 'input' | 'tool' | 'output';
  toolId?: string;
  label: string;
  icon: string;
  color: string;
  x: number;
  y: number;
  inputs: string[];
  outputs: string[];
}

interface Connection {
  id: string;
  from: string;
  to: string;
}

const TOOL_PALETTE = [
  { id: 'deep_reasoner', label: 'Deep Reasoner', icon: 'fa-brain', color: 'purple', category: 'AI' },
  { id: 'video_analyst', label: 'Video Analyst', icon: 'fa-film', color: 'blue', category: 'AI' },
  { id: 'meeting_intel', label: 'Meeting Intel', icon: 'fa-users-rectangle', color: 'violet', category: 'AI' },
  { id: 'voice_studio', label: 'Voice Studio', icon: 'fa-podcast', color: 'amber', category: 'AI' },
  { id: 'deep_search', label: 'Deep Search', icon: 'fa-magnifying-glass-chart', color: 'sky', category: 'AI' },
  { id: 'vision_lab', label: 'Vision Lab', icon: 'fa-image', color: 'pink', category: 'AI' },
  { id: 'code_studio', label: 'Code Studio', icon: 'fa-laptop-code', color: 'indigo', category: 'AI' },
  { id: 'ai_assistant', label: 'AI Assistant', icon: 'fa-robot', color: 'rose', category: 'AI' },
];

const INPUT_TYPES = [
  { id: 'file_input', label: 'File Upload', icon: 'fa-file-arrow-up', color: 'emerald' },
  { id: 'text_input', label: 'Text Input', icon: 'fa-keyboard', color: 'cyan' },
  { id: 'data_source', label: 'Pulse Data', icon: 'fa-database', color: 'orange' },
];

const OUTPUT_TYPES = [
  { id: 'text_output', label: 'Text Output', icon: 'fa-file-lines', color: 'zinc' },
  { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-line', color: 'emerald' },
  { id: 'export', label: 'Export File', icon: 'fa-download', color: 'blue' },
];

const AICanvas: React.FC<AICanvasProps> = ({ onBack, apiKey }) => {
  const { canvasNodes, setCanvasNodes } = useWorkspace();
  const [nodes, setNodes] = useState<Node[]>([
    { id: '1', type: 'input', label: 'File Upload', icon: 'fa-file-arrow-up', color: 'emerald', x: 100, y: 200, inputs: [], outputs: ['data'] },
  ]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<{ from: string; type: 'input' | 'output' } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const addNode = (type: 'input' | 'tool' | 'output', config: any) => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type,
      toolId: config.id,
      label: config.label,
      icon: config.icon,
      color: config.color,
      x: 400 + Math.random() * 200,
      y: 200 + Math.random() * 200,
      inputs: type !== 'input' ? ['in'] : [],
      outputs: type !== 'output' ? ['out'] : [],
    };
    setNodes([...nodes, newNode]);
  };

  const handleNodeDrag = (nodeId: string, dx: number, dy: number) => {
    setNodes(nodes.map(n => 
      n.id === nodeId ? { ...n, x: n.x + dx, y: n.y + dy } : n
    ));
  };

  const deleteNode = (nodeId: string) => {
    setNodes(nodes.filter(n => n.id !== nodeId));
    setConnections(connections.filter(c => c.from !== nodeId && c.to !== nodeId));
  };

  const runWorkflow = async () => {
    console.log('Running workflow with nodes:', nodes);
    console.log('Connections:', connections);
    // TODO: Execute the workflow
  };

  return (
    <div className="ai-canvas">
      {/* Header */}
      <div className="canvas-header">
        <div className="canvas-header-left">
          <button onClick={onBack} className="canvas-back-btn">
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div className="canvas-title">
            <i className="fa-solid fa-diagram-project"></i>
            <span>AI Canvas</span>
          </div>
          <span className="canvas-subtitle">Visual Workflow Builder</span>
        </div>
        <div className="canvas-header-right">
          <button className="canvas-btn canvas-btn-secondary">
            <i className="fa-solid fa-folder-open"></i>
            Load Recipe
          </button>
          <button className="canvas-btn canvas-btn-secondary">
            <i className="fa-solid fa-save"></i>
            Save
          </button>
          <button onClick={runWorkflow} className="canvas-btn canvas-btn-primary">
            <i className="fa-solid fa-play"></i>
            Run Workflow
          </button>
        </div>
      </div>

      <div className="canvas-body">
        {/* Tool Palette - Left Sidebar */}
        <div className="canvas-palette">
          <div className="palette-section">
            <h4 className="palette-title">Inputs</h4>
            <div className="palette-items">
              {INPUT_TYPES.map(input => (
                <button
                  key={input.id}
                  className={`palette-item palette-item-${input.color}`}
                  onClick={() => addNode('input', input)}
                  draggable
                >
                  <i className={`fa-solid ${input.icon}`}></i>
                  <span>{input.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="palette-section">
            <h4 className="palette-title">AI Tools</h4>
            <div className="palette-items">
              {TOOL_PALETTE.map(tool => (
                <button
                  key={tool.id}
                  className={`palette-item palette-item-${tool.color}`}
                  onClick={() => addNode('tool', tool)}
                  draggable
                >
                  <i className={`fa-solid ${tool.icon}`}></i>
                  <span>{tool.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="palette-section">
            <h4 className="palette-title">Outputs</h4>
            <div className="palette-items">
              {OUTPUT_TYPES.map(output => (
                <button
                  key={output.id}
                  className={`palette-item palette-item-${output.color}`}
                  onClick={() => addNode('output', output)}
                  draggable
                >
                  <i className={`fa-solid ${output.icon}`}></i>
                  <span>{output.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="canvas-area" ref={canvasRef}>
          {/* Grid background */}
          <div className="canvas-grid" style={{ 
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` 
          }}>
            {/* SVG for connections */}
            <svg className="canvas-connections">
              {connections.map(conn => {
                const fromNode = nodes.find(n => n.id === conn.from);
                const toNode = nodes.find(n => n.id === conn.to);
                if (!fromNode || !toNode) return null;
                
                const x1 = fromNode.x + 140;
                const y1 = fromNode.y + 40;
                const x2 = toNode.x;
                const y2 = toNode.y + 40;
                const cx1 = x1 + 50;
                const cx2 = x2 - 50;
                
                return (
                  <path
                    key={conn.id}
                    d={`M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`}
                    className="canvas-connection-line"
                  />
                );
              })}
            </svg>

            {/* Nodes */}
            {nodes.map(node => (
              <div
                key={node.id}
                className={`canvas-node canvas-node-${node.type} canvas-node-${node.color} ${selectedNode === node.id ? 'selected' : ''}`}
                style={{ left: node.x, top: node.y }}
                onClick={() => setSelectedNode(node.id)}
                onMouseDown={(e) => {
                  if (e.button === 0) {
                    setDraggingNode(node.id);
                    const startX = e.clientX;
                    const startY = e.clientY;
                    
                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const dx = (moveEvent.clientX - startX) / zoom;
                      const dy = (moveEvent.clientY - startY) / zoom;
                      handleNodeDrag(node.id, dx, dy);
                    };
                    
                    const handleMouseUp = () => {
                      setDraggingNode(null);
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }
                }}
              >
                {/* Input port */}
                {node.inputs.length > 0 && (
                  <div className="node-port node-port-input">
                    <div className="port-dot"></div>
                  </div>
                )}
                
                {/* Node content */}
                <div className="node-icon">
                  <i className={`fa-solid ${node.icon}`}></i>
                </div>
                <div className="node-label">{node.label}</div>
                
                {/* Output port */}
                {node.outputs.length > 0 && (
                  <div className="node-port node-port-output">
                    <div className="port-dot"></div>
                  </div>
                )}
                
                {/* Delete button */}
                <button 
                  className="node-delete"
                  onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            ))}
          </div>

          {/* Zoom controls */}
          <div className="canvas-zoom-controls">
            <button onClick={() => setZoom(z => Math.min(z + 0.1, 2))}>
              <i className="fa-solid fa-plus"></i>
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))}>
              <i className="fa-solid fa-minus"></i>
            </button>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
              <i className="fa-solid fa-compress"></i>
            </button>
          </div>

          {/* Empty state */}
          {nodes.length === 0 && (
            <div className="canvas-empty">
              <i className="fa-solid fa-diagram-project"></i>
              <h3>Start Building Your Workflow</h3>
              <p>Drag tools from the palette or click to add nodes</p>
            </div>
          )}
        </div>

        {/* Properties Panel - Right Sidebar */}
        {selectedNode && (
          <div className="canvas-properties">
            <h4 className="properties-title">Properties</h4>
            {(() => {
              const node = nodes.find(n => n.id === selectedNode);
              if (!node) return null;
              return (
                <div className="properties-content">
                  <div className="property-group">
                    <label>Node Type</label>
                    <div className="property-value">{node.type}</div>
                  </div>
                  <div className="property-group">
                    <label>Label</label>
                    <input 
                      type="text" 
                      value={node.label}
                      onChange={(e) => setNodes(nodes.map(n => 
                        n.id === selectedNode ? { ...n, label: e.target.value } : n
                      ))}
                    />
                  </div>
                  {node.type === 'tool' && (
                    <div className="property-group">
                      <label>Configuration</label>
                      <textarea placeholder="Enter tool-specific settings..." />
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default AICanvas;
