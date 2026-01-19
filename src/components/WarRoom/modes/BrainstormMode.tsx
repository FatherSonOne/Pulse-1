import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AIMessage, ThinkingStep } from '../../../services/ragService';
import { SessionExport } from '../shared';

interface IdeaCluster {
  id: string;
  name: string;
  color: string;
  ideas: Idea[];
}

interface Idea {
  id: string;
  text: string;
  votes: number;
  tags: string[];
  clusterId?: string;
}

interface BrainstormModeProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  onSendMessage: (message: string) => void;
  sessionId?: string;
  sessionTitle?: string;
  documents?: { title: string; summary?: string }[];
}

const CLUSTER_COLORS = [
  { name: 'Blue', bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-400' },
  { name: 'Green', bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-400' },
  { name: 'Purple', bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-400' },
  { name: 'Orange', bg: 'bg-orange-500/20', border: 'border-orange-500/40', text: 'text-orange-400' },
  { name: 'Pink', bg: 'bg-pink-500/20', border: 'border-pink-500/40', text: 'text-pink-400' },
  { name: 'Cyan', bg: 'bg-cyan-500/20', border: 'border-cyan-500/40', text: 'text-cyan-400' },
];

export const BrainstormMode: React.FC<BrainstormModeProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  onSendMessage,
  sessionId = '',
  sessionTitle = 'Brainstorm Session',
  documents = []
}) => {
  const [input, setInput] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [topic, setTopic] = useState('');
  const [isTopicSet, setIsTopicSet] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [clusters, setClusters] = useState<IdeaCluster[]>([]);
  const [newIdeaText, setNewIdeaText] = useState('');
  const [activeView, setActiveView] = useState<'board' | 'chat' | 'mindmap'>('board');
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ideaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSetTopic = () => {
    if (!topic.trim()) return;
    setIsTopicSet(true);
    // Send initial prompt to AI
    onSendMessage(`[BRAINSTORM SESSION] I want to brainstorm about: "${topic}".
Help me generate creative ideas, explore different angles, and think outside the box.
Start by giving me 3-5 initial ideas to consider.`);
  };

  const handleAddIdea = () => {
    if (!newIdeaText.trim()) return;
    const newIdea: Idea = {
      id: `idea-${Date.now()}`,
      text: newIdeaText.trim(),
      votes: 0,
      tags: [],
      clusterId: selectedCluster || undefined
    };
    setIdeas([...ideas, newIdea]);
    setNewIdeaText('');
    ideaInputRef.current?.focus();
  };

  const handleVoteIdea = (ideaId: string, delta: number) => {
    setIdeas(ideas.map(idea =>
      idea.id === ideaId
        ? { ...idea, votes: Math.max(0, idea.votes + delta) }
        : idea
    ));
  };

  const handleCreateCluster = (name: string) => {
    const colorIndex = clusters.length % CLUSTER_COLORS.length;
    const newCluster: IdeaCluster = {
      id: `cluster-${Date.now()}`,
      name,
      color: CLUSTER_COLORS[colorIndex].name,
      ideas: []
    };
    setClusters([...clusters, newCluster]);
  };

  const handleMoveToCluster = (ideaId: string, clusterId: string | null) => {
    setIdeas(ideas.map(idea =>
      idea.id === ideaId
        ? { ...idea, clusterId: clusterId || undefined }
        : idea
    ));
  };

  const handleDeleteIdea = (ideaId: string) => {
    setIdeas(ideas.filter(idea => idea.id !== ideaId));
  };

  const handleAskAI = (prompt: string) => {
    const context = ideas.length > 0
      ? `\n\nCurrent ideas on the board:\n${ideas.map(i => `- ${i.text}`).join('\n')}`
      : '';
    onSendMessage(`[BRAINSTORM] ${prompt}${context}`);
  };

  const handleSend = () => {
    const message = input.trim();
    if (!message) return;
    handleAskAI(message);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleIdeaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddIdea();
    }
  };

  const getClusterColor = (clusterId?: string) => {
    if (!clusterId) return null;
    const cluster = clusters.find(c => c.id === clusterId);
    if (!cluster) return null;
    return CLUSTER_COLORS.find(c => c.name === cluster.color) || CLUSTER_COLORS[0];
  };

  const unclusteredIdeas = ideas.filter(i => !i.clusterId);
  const sortedIdeas = [...ideas].sort((a, b) => b.votes - a.votes);

  const quickPrompts = [
    'Give me 5 wild, unconventional ideas',
    'What are we missing? Find the blind spots',
    'How would a competitor approach this?',
    'Combine the top ideas into something new',
    'What\'s the simplest solution possible?'
  ];

  // Topic setup screen
  if (!isTopicSet) {
    return (
      <div className="h-full w-full flex items-center justify-center war-room-container">
        <div className="max-w-lg w-full p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
              <i className="fa fa-lightbulb text-3xl text-yellow-400"></i>
            </div>
            <h2 className="text-2xl font-bold war-room-text-primary mb-2">Brainstorm Mode</h2>
            <p className="war-room-text-secondary">
              Generate ideas, cluster themes, and explore creative solutions
            </p>
          </div>

          <div className="war-room-panel p-6">
            <label className="block text-sm font-medium war-room-text-primary mb-2">
              What do you want to brainstorm about?
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetTopic()}
              placeholder="e.g., New product features, Marketing strategies, Team improvements..."
              className="w-full px-4 py-3 bg-black/30 border border-white/20 rounded-lg text-white placeholder-white/40 focus:border-yellow-500/50 focus:outline-none"
              autoFocus
            />

            <button
              onClick={handleSetTopic}
              disabled={!topic.trim()}
              className="w-full mt-4 war-room-btn war-room-btn-primary py-3"
            >
              <i className="fa fa-rocket mr-2"></i>
              Start Brainstorming
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs war-room-text-secondary mb-3">Or try a prompt:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Product ideas', 'Process improvements', 'Growth strategies'].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => setTopic(suggestion)}
                  className="war-room-btn text-xs px-3 py-1.5"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex war-room-container overflow-hidden">
      {/* Ideas Board Panel */}
      <div className="w-80 shrink-0 border-r border-white/10 flex flex-col bg-black/20">
        {/* Topic Header */}
        <div className="p-4 border-b border-white/10 bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
          <div className="flex items-center gap-2 mb-2">
            <i className="fa fa-lightbulb text-yellow-400"></i>
            <h3 className="text-sm font-semibold war-room-text-primary truncate">{topic}</h3>
          </div>
          <div className="flex items-center gap-2 text-xs war-room-text-secondary">
            <span>{ideas.length} ideas</span>
            <span>•</span>
            <span>{clusters.length} clusters</span>
          </div>
        </div>

        {/* Add Idea Input */}
        <div className="p-3 border-b border-white/10">
          <div className="flex gap-2">
            <input
              ref={ideaInputRef}
              type="text"
              value={newIdeaText}
              onChange={(e) => setNewIdeaText(e.target.value)}
              onKeyDown={handleIdeaKeyDown}
              placeholder="Add an idea..."
              className="flex-1 px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-yellow-500/50 focus:outline-none"
            />
            <button
              onClick={handleAddIdea}
              disabled={!newIdeaText.trim()}
              className="war-room-btn war-room-btn-icon-sm war-room-btn-primary"
            >
              <i className="fa fa-plus text-xs"></i>
            </button>
          </div>
        </div>

        {/* Clusters */}
        <div className="p-3 border-b border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold war-room-text-secondary uppercase tracking-wider">Clusters</span>
            <button
              onClick={() => {
                const name = prompt('Cluster name:');
                if (name) handleCreateCluster(name);
              }}
              className="war-room-btn war-room-btn-icon-sm"
              title="Add cluster"
            >
              <i className="fa fa-plus text-xs"></i>
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setSelectedCluster(null)}
              className={`war-room-btn text-xs px-2 py-1 ${!selectedCluster ? 'bg-white/20' : ''}`}
            >
              All
            </button>
            {clusters.map(cluster => {
              const color = CLUSTER_COLORS.find(c => c.name === cluster.color) || CLUSTER_COLORS[0];
              return (
                <button
                  key={cluster.id}
                  onClick={() => setSelectedCluster(cluster.id)}
                  className={`text-xs px-2 py-1 rounded-lg border transition-all ${color.bg} ${color.border} ${color.text} ${
                    selectedCluster === cluster.id ? 'ring-1 ring-white/30' : ''
                  }`}
                >
                  {cluster.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ideas List */}
        <div className="flex-1 overflow-y-auto war-room-scrollbar p-3 space-y-2">
          {(selectedCluster ? ideas.filter(i => i.clusterId === selectedCluster) : ideas).map(idea => {
            const clusterColor = getClusterColor(idea.clusterId);
            return (
              <div
                key={idea.id}
                className={`war-room-panel p-3 group ${
                  clusterColor ? `${clusterColor.bg} ${clusterColor.border}` : ''
                }`}
              >
                <p className="text-sm war-room-text-primary mb-2">{idea.text}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleVoteIdea(idea.id, 1)}
                      className="war-room-btn war-room-btn-icon-sm opacity-50 hover:opacity-100"
                    >
                      <i className="fa fa-arrow-up text-xs"></i>
                    </button>
                    <span className={`text-xs font-medium ${idea.votes > 0 ? 'text-yellow-400' : 'war-room-text-secondary'}`}>
                      {idea.votes}
                    </span>
                    <button
                      onClick={() => handleVoteIdea(idea.id, -1)}
                      className="war-room-btn war-room-btn-icon-sm opacity-50 hover:opacity-100"
                    >
                      <i className="fa fa-arrow-down text-xs"></i>
                    </button>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {clusters.length > 0 && (
                      <select
                        value={idea.clusterId || ''}
                        onChange={(e) => handleMoveToCluster(idea.id, e.target.value || null)}
                        className="text-xs bg-black/50 border border-white/20 rounded px-1 py-0.5 text-white"
                      >
                        <option value="">No cluster</option>
                        {clusters.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => handleDeleteIdea(idea.id)}
                      className="war-room-btn war-room-btn-icon-sm text-red-400 opacity-50 hover:opacity-100"
                    >
                      <i className="fa fa-trash text-xs"></i>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {ideas.length === 0 && (
            <div className="text-center py-8 war-room-text-secondary">
              <i className="fa fa-lightbulb text-2xl opacity-30 mb-2"></i>
              <p className="text-sm">No ideas yet</p>
              <p className="text-xs opacity-70">Add your own or ask AI for suggestions</p>
            </div>
          )}
        </div>

        {/* Top Ideas Summary */}
        {ideas.length >= 3 && (
          <div className="p-3 border-t border-white/10 bg-black/20">
            <p className="text-xs font-semibold war-room-text-secondary uppercase tracking-wider mb-2">
              <i className="fa fa-trophy text-yellow-400 mr-1"></i>
              Top Rated
            </p>
            <div className="space-y-1">
              {sortedIdeas.slice(0, 3).map((idea, i) => (
                <div key={idea.id} className="flex items-center gap-2 text-xs">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i === 0 ? 'bg-yellow-500 text-black' :
                    i === 1 ? 'bg-gray-400 text-black' :
                    'bg-orange-700 text-white'
                  }`}>{i + 1}</span>
                  <span className="war-room-text-primary truncate flex-1">{idea.text}</span>
                  <span className="text-yellow-400">{idea.votes}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Chat/AI Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* View Tabs */}
        <div className="shrink-0 p-3 border-b border-white/10 flex items-center justify-between bg-black/20">
          <div className="flex gap-2">
            {[
              { id: 'board', icon: 'fa-table-cells', label: 'Board' },
              { id: 'chat', icon: 'fa-comments', label: 'AI Chat' },
            ].map(view => (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id as any)}
                className={`war-room-btn text-xs px-3 py-1.5 flex items-center gap-1.5 ${
                  activeView === view.id ? 'bg-yellow-500/20 text-yellow-400' : ''
                }`}
              >
                <i className={`fa ${view.icon}`}></i>
                {view.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowExport(true)}
            className="war-room-btn war-room-btn-icon-sm"
            title="Export brainstorm"
          >
            <i className="fa fa-share-nodes text-xs"></i>
          </button>
        </div>

        {/* Quick AI Prompts */}
        <div className="shrink-0 px-4 py-2 border-b border-white/10 bg-gradient-to-r from-yellow-500/5 to-orange-500/5">
          <div className="flex gap-2 overflow-x-auto pb-1 war-room-scrollbar">
            {quickPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleAskAI(prompt)}
                className="war-room-btn text-xs px-3 py-1.5 whitespace-nowrap shrink-0"
              >
                <i className="fa fa-wand-magic-sparkles mr-1 text-yellow-400"></i>
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto war-room-scrollbar p-4">
          {activeView === 'chat' ? (
            // Chat View
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center max-w-md">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
                      <i className="fa fa-wand-magic-sparkles text-2xl text-yellow-400"></i>
                    </div>
                    <h3 className="text-lg font-semibold war-room-text-primary mb-2">
                      AI Brainstorm Partner
                    </h3>
                    <p className="text-sm war-room-text-secondary">
                      Ask for ideas, challenge assumptions, or explore new angles
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] ${
                        msg.role === 'user'
                          ? 'war-room-message-user'
                          : 'war-room-message-ai'
                      }`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                          <i className="fa fa-lightbulb text-yellow-400 text-xs"></i>
                          <span className="text-xs text-yellow-400 font-medium">Brainstorm AI</span>
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="war-room-message-ai">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-yellow-500/30 flex items-center justify-center">
                        <i className="fa fa-lightbulb text-yellow-400 text-xs animate-pulse"></i>
                      </div>
                      <span className="text-sm war-room-text-secondary">Generating ideas...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          ) : (
            // Board View - Visual Grid
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Unclustered Ideas */}
              {unclusteredIdeas.length > 0 && (
                <div className="col-span-full">
                  <h4 className="text-xs font-semibold war-room-text-secondary uppercase tracking-wider mb-3">
                    Unclustered Ideas
                  </h4>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {unclusteredIdeas.map(idea => (
                      <div
                        key={idea.id}
                        className="war-room-panel p-3 cursor-pointer hover:bg-white/5 transition-colors"
                      >
                        <p className="text-sm war-room-text-primary mb-2">{idea.text}</p>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs ${idea.votes > 0 ? 'text-yellow-400' : 'war-room-text-secondary'}`}>
                            <i className="fa fa-arrow-up mr-1"></i>{idea.votes}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Clusters */}
              {clusters.map(cluster => {
                const clusterIdeas = ideas.filter(i => i.clusterId === cluster.id);
                const color = CLUSTER_COLORS.find(c => c.name === cluster.color) || CLUSTER_COLORS[0];
                return (
                  <div key={cluster.id} className={`war-room-panel p-4 ${color.bg} ${color.border}`}>
                    <h4 className={`text-sm font-semibold ${color.text} mb-3 flex items-center gap-2`}>
                      <i className="fa fa-folder"></i>
                      {cluster.name}
                      <span className="war-room-badge text-xs">{clusterIdeas.length}</span>
                    </h4>
                    <div className="space-y-2">
                      {clusterIdeas.map(idea => (
                        <div
                          key={idea.id}
                          className="p-2 bg-black/20 rounded-lg"
                        >
                          <p className="text-xs war-room-text-primary">{idea.text}</p>
                          {idea.votes > 0 && (
                            <span className="text-[10px] text-yellow-400 mt-1 inline-block">
                              <i className="fa fa-arrow-up mr-1"></i>{idea.votes}
                            </span>
                          )}
                        </div>
                      ))}
                      {clusterIdeas.length === 0 && (
                        <p className="text-xs war-room-text-secondary italic">No ideas yet</p>
                      )}
                    </div>
                  </div>
                );
              })}

              {clusters.length === 0 && unclusteredIdeas.length === 0 && (
                <div className="col-span-full text-center py-12 war-room-text-secondary">
                  <i className="fa fa-table-cells text-4xl opacity-30 mb-4"></i>
                  <p className="text-sm">Your ideas will appear here</p>
                  <p className="text-xs opacity-70">Add ideas from the sidebar or ask AI for suggestions</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="shrink-0 p-4 war-room-input-area">
          <div className="flex items-center gap-2">
            <div className="flex-1 war-room-panel-inset flex items-center gap-2 px-4 py-3">
              <i className="fa fa-wand-magic-sparkles text-yellow-400 text-sm"></i>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask AI for more ideas, challenges, or perspectives..."
                className="flex-1 bg-transparent border-none outline-none text-sm"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={`war-room-btn war-room-btn-icon-sm ${
                  input.trim() ? 'war-room-btn-primary' : ''
                }`}
              >
                <i className="fa fa-paper-plane text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExport && (
        <SessionExport
          sessionId={sessionId}
          sessionTitle={sessionTitle}
          messages={messages}
          topic={topic}
          mode="Brainstorm Mode"
          documents={documents}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
};
