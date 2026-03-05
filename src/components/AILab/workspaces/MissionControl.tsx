import React, { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../shared/WorkspaceContext';
import { processWithModel } from '../../../services/geminiService';
import { generateDailyBriefing } from '../../../services/geminiService';
import { briefingService } from '../../../services/briefingService';
import { searchPerplexity } from '../../../services/perplexityService';
import AILabOutput from '../shared/AILabOutput';
import AILabEmptyState from '../shared/AILabEmptyState';
import { useToast } from '../shared/AILabToast';
import './MissionControl.css';

interface MissionControlProps {
  onBack: () => void;
  apiKey: string;
}

interface Panel {
  id: string;
  type: string;
  title: string;
  icon: string;
  color: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

interface BriefingData {
  greeting: string;
  summary: string;
  highlights: Array<{ category: string; title: string; detail: string; priority: string }>;
  suggestions: Array<{ action: string; reason: string; type: string }>;
}

const AVAILABLE_PANELS = [
  { type: 'deep_search', title: 'Deep Search', icon: 'fa-magnifying-glass-chart', color: 'sky' },
  { type: 'ai_assistant', title: 'AI Assistant', icon: 'fa-robot', color: 'rose' },
  { type: 'meeting_intel', title: 'Meeting Intel', icon: 'fa-users-rectangle', color: 'violet' },
  { type: 'voice_studio', title: 'Voice Studio', icon: 'fa-podcast', color: 'amber' },
  { type: 'route_planner', title: 'Route Planner', icon: 'fa-route', color: 'teal' },
  { type: 'action_items', title: 'Action Items', icon: 'fa-list-check', color: 'emerald' },
  { type: 'notes', title: 'Notes', icon: 'fa-sticky-note', color: 'yellow' },
  { type: 'data_view', title: 'Data View', icon: 'fa-table', color: 'blue' },
];

// Per-panel state stored outside component to survive re-renders
const panelSearchResults: Record<string, { text: string; citations: string[] }> = {};
const panelChatHistory: Record<string, ChatMessage[]> = {};
const panelNotes: Record<string, string> = {};
const panelTasks: Record<string, Array<{ id: string; text: string; done: boolean }>> = {};

const MissionControl: React.FC<MissionControlProps> = ({ onBack, apiKey }) => {
  const { missionName, setMissionName } = useWorkspace();
  const { showToast, ToastComponent } = useToast();
  const [panels, setPanels] = useState<Panel[]>([
    { id: '1', type: 'deep_search', title: 'Research', icon: 'fa-magnifying-glass-chart', color: 'sky', col: 1, row: 1, colSpan: 1, rowSpan: 1 },
    { id: '2', type: 'ai_assistant', title: 'AI Assistant', icon: 'fa-robot', color: 'rose', col: 2, row: 1, colSpan: 2, rowSpan: 1 },
    { id: '3', type: 'action_items', title: 'Action Items', icon: 'fa-list-check', color: 'emerald', col: 1, row: 2, colSpan: 1, rowSpan: 1 },
    { id: '4', type: 'notes', title: 'Notes', icon: 'fa-sticky-note', color: 'yellow', col: 2, row: 2, colSpan: 1, rowSpan: 1 },
  ]);
  const [showPanelPicker, setShowPanelPicker] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
  const [briefingData, setBriefingData] = useState<BriefingData | null>(null);
  const [showBriefingModal, setShowBriefingModal] = useState(false);

  // Per-panel local state triggers (force re-render when panel data changes)
  const [panelTick, setPanelTick] = useState(0);
  const refreshPanel = () => setPanelTick(t => t + 1);

  const addPanel = (config: typeof AVAILABLE_PANELS[0]) => {
    const newPanel: Panel = {
      id: `panel-${Date.now()}`,
      type: config.type,
      title: config.title,
      icon: config.icon,
      color: config.color,
      col: 3,
      row: 2,
      colSpan: 1,
      rowSpan: 1,
    };
    setPanels(prev => [...prev, newPanel]);
    setShowPanelPicker(false);
  };

  const removePanel = (id: string) => {
    setPanels(panels.filter(p => p.id !== id));
  };

  const generateBriefing = async () => {
    if (!apiKey) return;
    setIsGeneratingBriefing(true);
    try {
      const context = await briefingService.gatherBriefingContext();
      const contextStr = briefingService.buildContextString(context);
      const result = await generateDailyBriefing(apiKey, contextStr);
      setBriefingData(result as unknown as BriefingData);
      setShowBriefingModal(true);
    } catch (err) {
      console.error('Briefing generation failed:', err);
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  // Deep Search panel logic
  const DeepSearchPanel: React.FC<{ panelId: string }> = ({ panelId }) => {
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const result = panelSearchResults[panelId];

    const handleSearch = async () => {
      if (!query.trim()) return;
      setIsSearching(true);
      try {
        const res = await searchPerplexity(apiKey, query, 'research');
        panelSearchResults[panelId] = { text: res.text, citations: res.citations || [] };
        refreshPanel();
      } catch (err) {
        panelSearchResults[panelId] = { text: 'Search failed. Check your API key.', citations: [] };
        refreshPanel();
      } finally {
        setIsSearching(false);
      }
    };

    return (
      <div className="panel-search-wrapper">
        <div className="panel-search">
          <input
            type="text"
            placeholder="Research any topic..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button type="button" onClick={handleSearch} disabled={isSearching} aria-label="Search">
            <i className={`fa-solid ${isSearching ? 'fa-spinner fa-spin' : 'fa-search'}`}></i>
          </button>
        </div>
        {result && (
          <div className="panel-search-results">
            <AILabOutput
              content={result.text}
              accentColor="#a78bfa"
              accentRgb="167, 139, 250"
              label="Research"
            />
            {result.citations.length > 0 && (
              <div className="panel-citations">
                {result.citations.slice(0, 3).map((c, i) => {
                  let host = `Source ${i + 1}`;
                  try { host = new URL(c).hostname.replace('www.', ''); } catch {}
                  return (
                    <a key={i} href={c} target="_blank" rel="noreferrer" className="panel-citation-chip">
                      <i className="fa-solid fa-arrow-up-right-from-square"></i>
                      {host}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // AI Assistant chat panel logic
  const AIAssistantPanel: React.FC<{ panelId: string }> = ({ panelId }) => {
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messages = panelChatHistory[panelId] || [];
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [panelTick]);

    const sendMessage = async () => {
      if (!input.trim() || isSending) return;
      const userMsg: ChatMessage = { role: 'user', text: input, timestamp: new Date() };
      panelChatHistory[panelId] = [...messages, userMsg];
      setInput('');
      refreshPanel();
      setIsSending(true);
      try {
        const history = panelChatHistory[panelId].map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.text}`).join('\n');
        const result = await processWithModel(apiKey, `${history}\nUser: ${input}\nAI:`);
        const aiMsg: ChatMessage = { role: 'ai', text: result || 'No response.', timestamp: new Date() };
        panelChatHistory[panelId] = [...panelChatHistory[panelId], aiMsg];
        refreshPanel();
      } catch {
        const errMsg: ChatMessage = { role: 'ai', text: 'Error: AI call failed.', timestamp: new Date() };
        panelChatHistory[panelId] = [...(panelChatHistory[panelId] || []), errMsg];
        refreshPanel();
      } finally {
        setIsSending(false);
      }
    };

    return (
      <div className="panel-chat">
        <div className="chat-messages">
          {messages.length === 0 && (
            <AILabEmptyState
              icon="fa-robot"
              title="AI Assistant ready"
              description="Ask anything to get started"
              accentColor="#a78bfa"
              accentRgb="167, 139, 250"
              size="sm"
            />
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-message-wrap chat-wrap-${m.role === 'user' ? 'user' : 'ai'}`}>
              <div className={`chat-message chat-message-${m.role === 'user' ? 'user' : 'ai'}`}>
                {m.text}
              </div>
              <span className="mc-chat-timestamp">
                {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="chat-input">
          <input
            type="text"
            placeholder="Ask anything..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
          />
          <button type="button" onClick={sendMessage} disabled={isSending} aria-label="Send message">
            <i className={`fa-solid ${isSending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
          </button>
        </div>
      </div>
    );
  };

  // Action Items panel with real tasks
  const ActionItemsPanel: React.FC<{ panelId: string }> = ({ panelId }) => {
    const [newTaskText, setNewTaskText] = useState('');
    if (!panelTasks[panelId]) {
      panelTasks[panelId] = [
        { id: '1', text: 'Review research findings', done: false },
        { id: '2', text: 'Draft initial proposal', done: false },
      ];
    }
    const tasks = panelTasks[panelId];

    const toggleTask = (id: string) => {
      panelTasks[panelId] = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
      refreshPanel();
    };

    const addTask = () => {
      if (!newTaskText.trim()) return;
      panelTasks[panelId] = [...tasks, { id: Date.now().toString(), text: newTaskText, done: false }];
      setNewTaskText('');
      refreshPanel();
    };

    return (
      <div className="panel-tasks">
        {tasks.map(task => (
          <div key={task.id} className={`task-item ${task.done ? 'task-done' : ''}`}>
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => toggleTask(task.id)}
              aria-label={task.text}
            />
            <span>{task.text}</span>
          </div>
        ))}
        <div className="task-item task-item-add">
          <input
            type="text"
            placeholder="Add task..."
            value={newTaskText}
            onChange={e => setNewTaskText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            className="task-add-input"
          />
        </div>
      </div>
    );
  };

  // Notes panel with localStorage persistence
  const NotesPanel: React.FC<{ panelId: string }> = ({ panelId }) => {
    const storageKey = `mc_notes_${panelId}`;
    const [noteText, setNoteText] = useState(() => {
      return panelNotes[panelId] || localStorage.getItem(storageKey) || '';
    });

    const handleChange = (val: string) => {
      setNoteText(val);
      panelNotes[panelId] = val;
      localStorage.setItem(storageKey, val);
    };

    return (
      <div className="panel-notes">
        <textarea
          placeholder="Take notes here..."
          value={noteText}
          onChange={e => handleChange(e.target.value)}
        />
      </div>
    );
  };

  const renderPanelContent = (panel: Panel) => {
    switch (panel.type) {
      case 'deep_search':
        return <DeepSearchPanel panelId={panel.id} />;
      case 'ai_assistant':
        return <AIAssistantPanel panelId={panel.id} />;
      case 'action_items':
        return <ActionItemsPanel panelId={panel.id} />;
      case 'notes':
        return <NotesPanel panelId={panel.id} />;
      default:
        return (
          <div className="panel-placeholder">
            <i className={`fa-solid ${panel.icon}`}></i>
            <span>{panel.title}</span>
          </div>
        );
    }
  };

  return (
    <div className="mission-control">
      {/* Header */}
      <div className="mission-header">
        <div className="mission-header-left">
          <button type="button" onClick={onBack} className="mission-back-btn" aria-label="Go back">
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div className="mission-branding">
            <i className="fa-solid fa-grid-2-plus"></i>
            <span>Mission Control</span>
          </div>
          {isEditingName ? (
            <input
              type="text"
              className="mission-name-input"
              value={missionName}
              onChange={(e) => setMissionName(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
              placeholder="Mission name"
              aria-label="Mission name"
              autoFocus
            />
          ) : (
            <button
              type="button"
              className="mission-name"
              onClick={() => setIsEditingName(true)}
            >
              🎯 {missionName}
              <i className="fa-solid fa-pen"></i>
            </button>
          )}
        </div>
        <div className="mission-header-right">
          <button
            type="button"
            className="mission-btn mission-btn-secondary"
            onClick={() => setShowPanelPicker(true)}
          >
            <i className="fa-solid fa-plus"></i>
            Add Panel
          </button>
          <button
            type="button"
            className="mission-btn mission-btn-secondary"
            onClick={() => setPanels([
              { id: '1', type: 'deep_search', title: 'Research', icon: 'fa-magnifying-glass-chart', color: 'sky', col: 1, row: 1, colSpan: 1, rowSpan: 1 },
              { id: '2', type: 'ai_assistant', title: 'AI Assistant', icon: 'fa-robot', color: 'rose', col: 2, row: 1, colSpan: 2, rowSpan: 1 },
              { id: '3', type: 'action_items', title: 'Action Items', icon: 'fa-list-check', color: 'emerald', col: 1, row: 2, colSpan: 1, rowSpan: 1 },
              { id: '4', type: 'notes', title: 'Notes', icon: 'fa-sticky-note', color: 'yellow', col: 2, row: 2, colSpan: 1, rowSpan: 1 },
            ])}
          >
            <i className="fa-solid fa-arrows-rotate"></i>
            Reset Layout
          </button>
          <button
            type="button"
            className="mission-btn mission-btn-primary"
            onClick={generateBriefing}
            disabled={isGeneratingBriefing}
          >
            {isGeneratingBriefing ? (
              <><i className="fa-solid fa-spinner fa-spin"></i> Generating...</>
            ) : (
              <><i className="fa-solid fa-file-export"></i> Generate Briefing</>
            )}
          </button>
        </div>
      </div>

      {/* Panel Grid */}
      <div className="mission-grid">
        {panels.map(panel => (
          <div
            key={panel.id}
            className={`mission-panel mission-panel-${panel.color}`}
            style={{'--panel-col': panel.col, '--panel-col-span': panel.colSpan, '--panel-row': panel.row, '--panel-row-span': panel.rowSpan} as React.CSSProperties}
          >
            <div className="panel-header">
              <div className="panel-title">
                <i className={`fa-solid ${panel.icon}`}></i>
                <span>{panel.title}</span>
              </div>
              <div className="panel-actions">
                <button type="button" className="panel-action panel-action-close" onClick={() => removePanel(panel.id)} title="Close">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>
            <div className="panel-content">
              {renderPanelContent(panel)}
            </div>
          </div>
        ))}
      </div>

      {/* Panel Picker Modal */}
      {showPanelPicker && (
        <div className="panel-picker-overlay" onClick={() => setShowPanelPicker(false)}>
          <div className="panel-picker" onClick={e => e.stopPropagation()}>
            <h3>Add Panel</h3>
            <div className="panel-picker-grid">
              {AVAILABLE_PANELS.map(p => (
                <button
                  key={p.type}
                  type="button"
                  className={`panel-picker-item panel-picker-${p.color}`}
                  onClick={() => addPanel(p)}
                >
                  <i className={`fa-solid ${p.icon}`}></i>
                  <span>{p.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Briefing Modal */}
      {showBriefingModal && briefingData && (
        <div className="panel-picker-overlay" onClick={() => setShowBriefingModal(false)}>
          <div className="briefing-modal" onClick={e => e.stopPropagation()}>
            <div className="briefing-modal-header">
              <h3>
                <i className="fa-solid fa-file-lines"></i>
                Daily Briefing
              </h3>
              <button type="button" className="panel-action" onClick={() => setShowBriefingModal(false)} aria-label="Close briefing">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="briefing-modal-body">
              <p className="briefing-greeting">{briefingData.greeting}</p>
              <p className="briefing-summary">{briefingData.summary}</p>
              {briefingData.highlights?.length > 0 && (
                <div className="briefing-highlights">
                  <h4>Highlights</h4>
                  {briefingData.highlights.map((h, i) => (
                    <div key={i} className={`briefing-highlight briefing-highlight-${h.priority}`}>
                      <span className="briefing-highlight-cat">{h.category}</span>
                      <strong>{h.title}</strong>
                      <p>{h.detail}</p>
                    </div>
                  ))}
                </div>
              )}
              {briefingData.suggestions?.length > 0 && (
                <div className="briefing-suggestions">
                  <h4>Suggested Actions</h4>
                  {briefingData.suggestions.map((s, i) => (
                    <div key={i} className="briefing-suggestion">
                      <i className="fa-solid fa-arrow-right"></i>
                      <div>
                        <strong>{s.action}</strong>
                        <p>{s.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="mission-btn mission-btn-secondary"
                onClick={() => navigator.clipboard.writeText(
                  `${briefingData.greeting}\n\n${briefingData.summary}\n\n${briefingData.highlights?.map(h => `${h.title}: ${h.detail}`).join('\n')}`
                )}
              >
                <i className="fa-solid fa-copy"></i> Copy Briefing
              </button>
            </div>
          </div>
        </div>
      )}
      {ToastComponent}
    </div>
  );
};

export default MissionControl;
