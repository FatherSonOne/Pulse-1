import React, { useState, useRef, useEffect } from 'react';
import { AIMessage, ThinkingStep } from '../../../services/ragService';
import { SessionExport } from '../shared';

interface ContentDraft {
  id: string;
  version: number;
  content: string;
  feedback?: string;
  timestamp: Date;
}

type CreatePhase = 'brief' | 'outline' | 'draft' | 'refine' | 'finalize';
type ContentType = 'blog' | 'email' | 'social' | 'copy' | 'script' | 'document';

interface CreateMissionProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  onSendMessage: (message: string) => void;
  sessionId?: string;
  sessionTitle?: string;
  documents?: { title: string; summary?: string }[];
}

const PHASES: { id: CreatePhase; label: string; icon: string; description: string }[] = [
  { id: 'brief', label: 'Brief', icon: 'fa-clipboard', description: 'Define requirements' },
  { id: 'outline', label: 'Outline', icon: 'fa-list-ol', description: 'Structure content' },
  { id: 'draft', label: 'Draft', icon: 'fa-pen', description: 'Write first draft' },
  { id: 'refine', label: 'Refine', icon: 'fa-wand-magic-sparkles', description: 'Polish & improve' },
  { id: 'finalize', label: 'Finalize', icon: 'fa-check-double', description: 'Final review' },
];

const CONTENT_TYPES: { id: ContentType; name: string; icon: string; description: string }[] = [
  { id: 'blog', name: 'Blog Post', icon: 'fa-newspaper', description: 'Long-form article' },
  { id: 'email', name: 'Email', icon: 'fa-envelope', description: 'Professional email' },
  { id: 'social', name: 'Social Post', icon: 'fa-share-nodes', description: 'Social media content' },
  { id: 'copy', name: 'Marketing Copy', icon: 'fa-bullhorn', description: 'Persuasive copy' },
  { id: 'script', name: 'Script', icon: 'fa-video', description: 'Video/podcast script' },
  { id: 'document', name: 'Document', icon: 'fa-file-lines', description: 'General document' },
];

const TONE_OPTIONS = [
  'Professional', 'Casual', 'Friendly', 'Authoritative', 'Conversational', 'Formal', 'Playful', 'Inspiring'
];

export const CreateMission: React.FC<CreateMissionProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  onSendMessage,
  sessionId = '',
  sessionTitle = 'Create Mission',
  documents = []
}) => {
  const [input, setInput] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<CreatePhase>('brief');
  const [contentType, setContentType] = useState<ContentType | null>(null);
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('Professional');
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [newKeyPoint, setNewKeyPoint] = useState('');
  const [outline, setOutline] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [currentDraft, setCurrentDraft] = useState('');
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSetBrief = () => {
    if (!contentType || !topic.trim()) return;
    setCurrentPhase('outline');
    const typeInfo = CONTENT_TYPES.find(t => t.id === contentType);
    onSendMessage(`[CREATE MISSION - Phase 1: Brief]
Content Type: ${typeInfo?.name} (${typeInfo?.description})
Topic: "${topic}"
Target Audience: ${audience || 'General'}
Tone: ${tone}
Key Points: ${keyPoints.join(', ') || 'Not specified'}

Help me plan this content:
1. Suggest an outline/structure
2. Identify key messages to convey
3. Recommend hooks or angles
4. Note any important considerations`);
  };

  const handleAddKeyPoint = () => {
    if (!newKeyPoint.trim()) return;
    setKeyPoints([...keyPoints, newKeyPoint.trim()]);
    setNewKeyPoint('');
  };

  const handleRemoveKeyPoint = (index: number) => {
    setKeyPoints(keyPoints.filter((_, i) => i !== index));
  };

  const handleSaveDraft = () => {
    if (!currentDraft.trim()) return;
    const newDraft: ContentDraft = {
      id: `draft-${Date.now()}`,
      version: drafts.length + 1,
      content: currentDraft,
      timestamp: new Date()
    };
    setDrafts([...drafts, newDraft]);
    setActiveDraftId(newDraft.id);
  };

  const handleLoadDraft = (draft: ContentDraft) => {
    setCurrentDraft(draft.content);
    setActiveDraftId(draft.id);
  };

  const handleAskAI = (prompt: string) => {
    const contentContext = `
Content Type: ${CONTENT_TYPES.find(t => t.id === contentType)?.name}
Topic: ${topic}
Audience: ${audience}
Tone: ${tone}
Key Points: ${keyPoints.join(', ')}
Current Outline: ${outline.join(' > ')}
Current Draft: ${currentDraft.slice(0, 500)}${currentDraft.length > 500 ? '...' : ''}
`;
    onSendMessage(`[CREATE MISSION - Phase: ${currentPhase}]\n${prompt}\n\nContent Context:${contentContext}`);
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

  const proceedToPhase = (phase: CreatePhase) => {
    setCurrentPhase(phase);

    const phasePrompts: Record<CreatePhase, string> = {
      brief: '',
      outline: `OUTLINE phase: Create a detailed outline for this ${CONTENT_TYPES.find(t => t.id === contentType)?.name}.
Topic: "${topic}"
Help me structure this content effectively.`,
      draft: `DRAFT phase: Write the first draft based on our outline.
Outline: ${outline.join(' > ')}
Write in a ${tone.toLowerCase()} tone for ${audience || 'general audience'}.`,
      refine: `REFINE phase: Review and improve this draft.
Current draft:
${currentDraft.slice(0, 1000)}${currentDraft.length > 1000 ? '...' : ''}

Suggest improvements for:
1. Clarity and flow
2. Engagement and impact
3. Grammar and style
4. Call-to-action effectiveness`,
      finalize: `FINALIZE phase: Final review of the content.
Provide:
1. Final proofread
2. SEO suggestions (if applicable)
3. Distribution recommendations
4. Any last improvements`
    };

    if (phasePrompts[phase]) {
      onSendMessage(`[CREATE MISSION - Phase: ${phase}]\n${phasePrompts[phase]}`);
    }
  };

  const generateDraft = () => {
    handleAskAI(`Generate a complete first draft for this ${CONTENT_TYPES.find(t => t.id === contentType)?.name} about "${topic}".
Follow this outline: ${outline.join(' > ')}
Use a ${tone.toLowerCase()} tone.
Target audience: ${audience || 'general'}
Include these key points: ${keyPoints.join(', ')}`);
  };

  const currentPhaseIndex = PHASES.findIndex(p => p.id === currentPhase);

  return (
    <div className="h-full w-full flex war-room-container overflow-hidden">
      {/* Control Panel */}
      <div className="w-80 shrink-0 border-r border-white/10 flex flex-col bg-black/20">
        {/* Mission Header */}
        <div className="p-4 border-b border-white/10 bg-gradient-to-r from-pink-500/10 to-rose-500/10">
          <div className="flex items-center gap-2 mb-2">
            <i className="fa fa-pen-nib text-pink-400"></i>
            <h3 className="text-sm font-semibold war-room-text-primary">Create Mission</h3>
          </div>
          {topic && (
            <p className="text-xs war-room-text-secondary line-clamp-2">{topic}</p>
          )}
          {contentType && (
            <div className="mt-2 flex items-center gap-2">
              <span className="war-room-badge text-xs">
                <i className={`fa ${CONTENT_TYPES.find(t => t.id === contentType)?.icon} mr-1`}></i>
                {CONTENT_TYPES.find(t => t.id === contentType)?.name}
              </span>
              <span className="war-room-badge text-xs">{tone}</span>
            </div>
          )}
        </div>

        {/* Phase Progress */}
        <div className="p-3 border-b border-white/10">
          <div className="flex gap-1">
            {PHASES.map((phase, i) => {
              const isActive = phase.id === currentPhase;
              const isComplete = i < currentPhaseIndex;
              return (
                <button
                  key={phase.id}
                  onClick={() => i <= currentPhaseIndex && setCurrentPhase(phase.id)}
                  disabled={i > currentPhaseIndex}
                  className={`flex-1 p-2 rounded transition-all ${
                    isActive
                      ? 'bg-pink-500/20 border border-pink-500/40'
                      : isComplete
                      ? 'bg-emerald-500/10'
                      : 'opacity-40'
                  }`}
                  title={phase.description}
                >
                  <i className={`fa ${phase.icon} ${isComplete ? 'text-emerald-400' : isActive ? 'text-pink-400' : 'text-white/40'}`}></i>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-center mt-2 war-room-text-secondary">
            {PHASES.find(p => p.id === currentPhase)?.description}
          </p>
        </div>

        {/* Phase Content */}
        <div className="flex-1 overflow-y-auto war-room-scrollbar p-3">
          {currentPhase === 'brief' && (
            <div className="space-y-4">
              {/* Content Type Selection */}
              <div>
                <label className="block text-xs font-medium war-room-text-primary mb-2">
                  Content Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CONTENT_TYPES.map(type => (
                    <button
                      key={type.id}
                      onClick={() => setContentType(type.id)}
                      className={`p-2 rounded-lg text-left transition-all ${
                        contentType === type.id
                          ? 'bg-pink-500/20 border border-pink-500/40'
                          : 'war-room-panel hover:bg-white/5'
                      }`}
                    >
                      <i className={`fa ${type.icon} ${contentType === type.id ? 'text-pink-400' : 'war-room-text-secondary'} mb-1`}></i>
                      <p className="text-xs font-medium war-room-text-primary">{type.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic */}
              <div>
                <label className="block text-xs font-medium war-room-text-primary mb-2">
                  Topic
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="What are you writing about?"
                  className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-pink-500/50 focus:outline-none"
                />
              </div>

              {/* Audience */}
              <div>
                <label className="block text-xs font-medium war-room-text-primary mb-2">
                  Target Audience
                </label>
                <input
                  type="text"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Who is this for?"
                  className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-pink-500/50 focus:outline-none"
                />
              </div>

              {/* Tone */}
              <div>
                <label className="block text-xs font-medium war-room-text-primary mb-2">
                  Tone
                </label>
                <div className="flex flex-wrap gap-1">
                  {TONE_OPTIONS.map(t => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={`px-2 py-1 rounded text-xs transition-all ${
                        tone === t
                          ? 'bg-pink-500 text-white'
                          : 'war-room-btn'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Key Points */}
              <div>
                <label className="block text-xs font-medium war-room-text-primary mb-2">
                  Key Points
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newKeyPoint}
                    onChange={(e) => setNewKeyPoint(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddKeyPoint()}
                    placeholder="Add key point..."
                    className="flex-1 px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none"
                  />
                  <button
                    onClick={handleAddKeyPoint}
                    disabled={!newKeyPoint.trim()}
                    className="war-room-btn war-room-btn-icon-sm war-room-btn-primary"
                  >
                    <i className="fa fa-plus text-xs"></i>
                  </button>
                </div>
                <div className="space-y-1">
                  {keyPoints.map((point, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs group">
                      <i className="fa fa-check-circle text-pink-400"></i>
                      <span className="flex-1 war-room-text-secondary">{point}</span>
                      <button
                        onClick={() => handleRemoveKeyPoint(i)}
                        className="opacity-0 group-hover:opacity-100 text-red-400"
                      >
                        <i className="fa fa-times"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSetBrief}
                disabled={!contentType || !topic.trim()}
                className="w-full war-room-btn war-room-btn-primary py-2"
              >
                <i className="fa fa-arrow-right mr-2"></i>
                Create Outline
              </button>
            </div>
          )}

          {currentPhase === 'outline' && (
            <div className="space-y-3">
              <p className="text-xs war-room-text-secondary">
                Structure your content:
              </p>

              <div className="space-y-2">
                {outline.map((item, i) => (
                  <div key={i} className="war-room-panel p-2 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-pink-500/20 text-pink-400 text-xs flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-xs war-room-text-primary flex-1">{item}</span>
                    <button
                      onClick={() => setOutline(outline.filter((_, idx) => idx !== i))}
                      className="text-red-400 opacity-50 hover:opacity-100"
                    >
                      <i className="fa fa-times text-[10px]"></i>
                    </button>
                  </div>
                ))}
              </div>

              <input
                type="text"
                placeholder="Add section..."
                className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const value = (e.target as HTMLInputElement).value.trim();
                    if (value) {
                      setOutline([...outline, value]);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
              />

              <button
                onClick={() => handleAskAI('Suggest a detailed outline structure')}
                disabled={isLoading}
                className="w-full war-room-btn py-2"
              >
                <i className="fa fa-wand-magic-sparkles mr-2"></i>
                AI Suggest Outline
              </button>

              {outline.length >= 2 && (
                <button
                  onClick={() => proceedToPhase('draft')}
                  className="w-full war-room-btn war-room-btn-primary py-2"
                >
                  <i className="fa fa-arrow-right mr-2"></i>
                  Start Writing
                </button>
              )}
            </div>
          )}

          {currentPhase === 'draft' && (
            <div className="space-y-3">
              <button
                onClick={generateDraft}
                disabled={isLoading}
                className="w-full war-room-btn war-room-btn-primary py-2"
              >
                <i className="fa fa-wand-magic-sparkles mr-2"></i>
                Generate Draft
              </button>

              <button
                onClick={handleSaveDraft}
                disabled={!currentDraft.trim()}
                className="w-full war-room-btn py-2"
              >
                <i className="fa fa-save mr-2"></i>
                Save Draft
              </button>

              {drafts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs war-room-text-secondary">Draft versions:</p>
                  {drafts.map(draft => (
                    <button
                      key={draft.id}
                      onClick={() => handleLoadDraft(draft)}
                      className={`w-full war-room-panel p-2 text-left ${
                        activeDraftId === draft.id ? 'ring-1 ring-pink-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium war-room-text-primary">
                          Version {draft.version}
                        </span>
                        <span className="text-[10px] war-room-text-secondary">
                          {draft.content.length} chars
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {currentDraft.length > 100 && (
                <button
                  onClick={() => proceedToPhase('refine')}
                  className="w-full war-room-btn war-room-btn-primary py-2"
                >
                  <i className="fa fa-arrow-right mr-2"></i>
                  Refine Draft
                </button>
              )}
            </div>
          )}

          {currentPhase === 'refine' && (
            <div className="space-y-3">
              <p className="text-xs war-room-text-secondary">
                Improve your draft:
              </p>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: 'fa-spell-check', label: 'Grammar', prompt: 'Fix any grammar and spelling issues' },
                  { icon: 'fa-compress', label: 'Concise', prompt: 'Make it more concise and punchy' },
                  { icon: 'fa-expand', label: 'Expand', prompt: 'Add more detail and depth' },
                  { icon: 'fa-fire', label: 'Engaging', prompt: 'Make it more engaging and compelling' },
                ].map(action => (
                  <button
                    key={action.label}
                    onClick={() => handleAskAI(action.prompt)}
                    disabled={isLoading}
                    className="war-room-btn p-2 flex flex-col items-center gap-1"
                  >
                    <i className={`fa ${action.icon} text-pink-400`}></i>
                    <span className="text-xs">{action.label}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => proceedToPhase('finalize')}
                className="w-full war-room-btn war-room-btn-primary py-2"
              >
                <i className="fa fa-arrow-right mr-2"></i>
                Finalize
              </button>
            </div>
          )}

          {currentPhase === 'finalize' && (
            <div className="space-y-4">
              <div className="war-room-panel p-3 bg-pink-500/10 border-pink-500/30">
                <h4 className="text-xs font-semibold text-pink-400 mb-2">Content Summary</h4>
                <div className="space-y-1 text-xs war-room-text-secondary">
                  <p><strong>Type:</strong> {CONTENT_TYPES.find(t => t.id === contentType)?.name}</p>
                  <p><strong>Topic:</strong> {topic}</p>
                  <p><strong>Length:</strong> {currentDraft.length} characters</p>
                  <p><strong>Versions:</strong> {drafts.length}</p>
                </div>
              </div>

              <button
                onClick={() => handleAskAI('Perform a final review and proofread')}
                disabled={isLoading}
                className="w-full war-room-btn war-room-btn-primary py-2"
              >
                <i className="fa fa-check-double mr-2"></i>
                Final Review
              </button>

              <button
                onClick={() => navigator.clipboard.writeText(currentDraft)}
                disabled={!currentDraft}
                className="w-full war-room-btn py-2"
              >
                <i className="fa fa-copy mr-2"></i>
                Copy to Clipboard
              </button>
            </div>
          )}
        </div>

        {/* Export */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => setShowExport(true)}
            className="w-full war-room-btn py-2"
          >
            <i className="fa fa-share-nodes mr-2"></i>
            Export Content
          </button>
        </div>
      </div>

      {/* Main Editor/Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Draft Editor (visible in draft/refine/finalize phases) */}
        {['draft', 'refine', 'finalize'].includes(currentPhase) && (
          <div className="shrink-0 p-4 border-b border-white/10 bg-black/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium war-room-text-secondary">
                <i className="fa fa-pen mr-1"></i>
                Draft Editor
              </span>
              <span className="text-xs war-room-text-secondary">
                {currentDraft.length} characters
              </span>
            </div>
            <textarea
              ref={draftRef}
              value={currentDraft}
              onChange={(e) => setCurrentDraft(e.target.value)}
              placeholder="Start writing your content here..."
              className="w-full h-40 px-4 py-3 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-pink-500/50 focus:outline-none resize-none war-room-scrollbar"
            />
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto war-room-scrollbar p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
                  <i className="fa fa-pen-nib text-2xl text-pink-400"></i>
                </div>
                <h3 className="text-lg font-semibold war-room-text-primary mb-2">
                  Create Mission
                </h3>
                <p className="text-sm war-room-text-secondary">
                  A guided content creation workflow.
                  Set your brief to begin.
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
                      <i className="fa fa-pen-nib text-pink-400 text-xs"></i>
                      <span className="text-xs text-pink-400 font-medium">Writing AI</span>
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
                  <div className="w-5 h-5 rounded-full bg-pink-500/30 flex items-center justify-center">
                    <i className="fa fa-pen-nib text-pink-400 text-xs animate-pulse"></i>
                  </div>
                  <span className="text-sm war-room-text-secondary">Writing...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 p-4 war-room-input-area">
          <div className="flex items-center gap-2">
            <div className="flex-1 war-room-panel-inset flex items-center gap-2 px-4 py-3">
              <i className="fa fa-comments text-pink-400 text-sm"></i>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask for suggestions, revisions, or ideas..."
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
          mode="Create Mission"
          documents={documents}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
};
