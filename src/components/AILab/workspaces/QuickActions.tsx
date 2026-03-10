import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../shared/WorkspaceContext';
import { processWithModel, summarizeText } from '../../../services/geminiService';
import ShareToChannelModal from '../shared/ShareToChannelModal';
import AILabOutput from '../shared/AILabOutput';
import AILabProgress from '../shared/AILabProgress';
import AILabEmptyState from '../shared/AILabEmptyState';
import { useToast } from '../shared/AILabToast';
import './QuickActions.css';

import { ArrowLeft, ArrowRight, Eraser, Keyboard, Search, Sparkles, Zap } from 'lucide-react';

interface QuickActionsProps {
  onBack: () => void;
  apiKey: string;
}

interface QuickAction {
  id: string;
  icon: string;
  label: string;
  shortcut: string;
  category: 'create' | 'analyze' | 'transform' | 'communicate';
  color: string;
  description: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'summarize', icon: 'fa-compress', label: 'Summarize', shortcut: '⌘+S', category: 'analyze', color: 'sky', description: 'Create a concise summary of any content' },
  { id: 'expand', icon: 'fa-expand', label: 'Expand', shortcut: '⌘+E', category: 'transform', color: 'violet', description: 'Elaborate and add more detail' },
  { id: 'translate', icon: 'fa-language', label: 'Translate', shortcut: '⌘+T', category: 'transform', color: 'emerald', description: 'Translate to any language' },
  { id: 'rewrite', icon: 'fa-pen-nib', label: 'Rewrite', shortcut: '⌘+R', category: 'transform', color: 'amber', description: 'Improve tone and clarity' },
  { id: 'analyze', icon: 'fa-chart-line', label: 'Analyze', shortcut: '⌘+A', category: 'analyze', color: 'rose', description: 'Extract insights and patterns' },
  { id: 'extract', icon: 'fa-filter', label: 'Extract', shortcut: '⌘+X', category: 'analyze', color: 'cyan', description: 'Pull out specific data points' },
  { id: 'email', icon: 'fa-envelope', label: 'Draft Email', shortcut: '⌘+M', category: 'communicate', color: 'blue', description: 'Compose professional emails' },
  { id: 'reply', icon: 'fa-reply', label: 'Smart Reply', shortcut: '⌘+Y', category: 'communicate', color: 'indigo', description: 'Generate contextual responses' },
  { id: 'tasks', icon: 'fa-list-check', label: 'To Tasks', shortcut: '⌘+K', category: 'create', color: 'green', description: 'Convert text into actionable tasks' },
  { id: 'explain', icon: 'fa-lightbulb', label: 'Explain', shortcut: '⌘+?', category: 'analyze', color: 'yellow', description: 'Break down complex concepts' },
  { id: 'fix', icon: 'fa-wrench', label: 'Fix & Polish', shortcut: '⌘+F', category: 'transform', color: 'orange', description: 'Correct grammar and style' },
  { id: 'format', icon: 'fa-table', label: 'Format', shortcut: '⌘+B', category: 'create', color: 'pink', description: 'Structure content as tables or lists' },
];

const CATEGORIES = [
  { id: 'all', label: 'All Actions', icon: 'fa-grid-2' },
  { id: 'create', label: 'Create', icon: 'fa-plus' },
  { id: 'analyze', label: 'Analyze', icon: 'fa-magnifying-glass-chart' },
  { id: 'transform', label: 'Transform', icon: 'fa-wand-magic-sparkles' },
  { id: 'communicate', label: 'Communicate', icon: 'fa-comments' },
];

// Color name → hex/rgb lookup for CSS var injection
const COLOR_MAP: Record<string, { hex: string; rgb: string }> = {
  sky:     { hex: '#38bdf8', rgb: '56,189,248' },
  violet:  { hex: '#8b5cf6', rgb: '139,92,246' },
  emerald: { hex: '#34d399', rgb: '52,211,153' },
  amber:   { hex: '#fbbf24', rgb: '251,191,36' },
  rose:    { hex: '#fb7185', rgb: '251,113,133' },
  cyan:    { hex: '#22d3ee', rgb: '34,211,238' },
  blue:    { hex: '#60a5fa', rgb: '96,165,250' },
  indigo:  { hex: '#818cf8', rgb: '129,140,248' },
  green:   { hex: '#4ade80', rgb: '74,222,128' },
  yellow:  { hex: '#facc15', rgb: '250,204,21' },
  orange:  { hex: '#fb923c', rgb: '251,146,60' },
  pink:    { hex: '#f472b6', rgb: '244,114,182' },
};

const QuickActions: React.FC<QuickActionsProps> = ({ onBack, apiKey }) => {
  const { teamChannels, currentUser } = useWorkspace();
  const { showToast, ToastComponent } = useToast();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [selectedAction, setSelectedAction] = useState<QuickAction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentActions, setRecentActions] = useState<string[]>(['summarize', 'email', 'analyze']);
  const [showShare, setShowShare] = useState(false);

  const filteredActions = QUICK_ACTIONS.filter(action => {
    const matchesCategory = selectedCategory === 'all' || action.category === selectedCategory;
    const matchesSearch = action.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          action.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const executeAction = async (action: QuickAction) => {
    if (!inputText.trim()) {
      setOutputText('Please enter some text to process.');
      return;
    }

    setSelectedAction(action);
    setIsProcessing(true);
    setOutputText('');

    try {
      const prompts: Record<string, string> = {
        expand: `Expand the following text with more detail, supporting examples, and additional context. Return only the expanded content:\n\n${inputText}`,
        translate: `Detect the language of the following text. If it is English, translate to Spanish. If it is not English, translate to English. Start with "Detected language: [language]". Return the translation:\n\n${inputText}`,
        rewrite: `Rewrite the following for improved clarity, professional tone, and impact. Keep the core meaning intact. Return only the rewritten version:\n\n${inputText}`,
        analyze: `Analyze the following text and return a structured report with these sections:\n- **Sentiment** (positive/negative/neutral with confidence %)\n- **Word Count** and reading level\n- **Key Themes** (3-5 bullet points)\n- **Tone Assessment**\n- **Actionable Insights**\n\nText:\n${inputText}`,
        extract: `Extract all structured data from the following text. Present as markdown tables:\n- Action items or tasks\n- Dates and deadlines\n- People and roles mentioned\n- Key numbers and amounts\n- Links or references\n\nText:\n${inputText}`,
        email: `Draft a professional email based on the following context. Include subject line, greeting, body paragraphs, and sign-off. Return only the email:\n\n${inputText}`,
        reply: `Write a thoughtful, professional reply to the following message. Be concise and constructive:\n\n${inputText}`,
        tasks: `Convert the following content into a clear list of actionable tasks. For each task include the task description (starting with an action verb), priority (High/Medium/Low if determinable), owner if mentioned, and deadline if mentioned:\n\n${inputText}`,
        explain: `Explain the following in simple, clear terms that a non-expert would understand. Include a real-world analogy and highlight the key takeaway:\n\n${inputText}`,
        fix: `Fix all grammar, spelling, punctuation, and style issues in the following text. Return the corrected version first, then a bullet list of the main changes made:\n\n${inputText}`,
        format: `Format the following content using appropriate markdown structure (headers, bullet points, numbered lists, tables where helpful). Make it scannable and well-organized. Return only the formatted content:\n\n${inputText}`,
      };

      let result: string | null;
      if (action.id === 'summarize') {
        result = await summarizeText(apiKey, inputText);
      } else {
        result = await processWithModel(apiKey, prompts[action.id] || `${action.label} the following:\n\n${inputText}`);
      }

      setOutputText(result || 'No output generated. Check your API key in Settings.');
    } catch (err) {
      setOutputText(`Error: ${err instanceof Error ? err.message : 'AI call failed. Check your API key in Settings.'}`);
    } finally {
      setIsProcessing(false);
    }

    setRecentActions(prev => [action.id, ...prev.filter(id => id !== action.id)].slice(0, 5));
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        const action = QUICK_ACTIONS.find(a => 
          a.shortcut.toLowerCase().includes(e.key.toLowerCase())
        );
        if (action) {
          e.preventDefault();
          executeAction(action);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputText]);

  return (
    <div className="quick-actions">
      {/* Header */}
      <div className="qa-header">
        <div className="qa-header-left">
          <button onClick={onBack} className="qa-back-btn">
            <ArrowLeft />
          </button>
          <div className="qa-branding">
            <Zap />
            <span>Quick Actions</span>
          </div>
          <span className="qa-subtitle">Context-Aware AI Toolbar</span>
        </div>
        <div className="qa-header-right">
          <div className="qa-search">
            <Search />
            <input
              type="text"
              placeholder="Search actions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="qa-search-hint">⌘K</span>
          </div>
        </div>
      </div>

      <div className="qa-body">
        {/* Left: Input & Output */}
        <div className="qa-main">
          <div className="qa-input-section">
            <label>
              <Keyboard />
              Input
            </label>
            <textarea
              placeholder="Paste or type your content here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <div className="qa-input-footer">
              <span>{inputText.split(' ').filter(Boolean).length} words</span>
              <button onClick={() => setInputText('')}>
                <Eraser />
                Clear
              </button>
            </div>
          </div>

          <div className="qa-output-section">
            <label>
              <Sparkles />
              Output
              {selectedAction && (
                <span className="qa-output-action">
                  via {selectedAction.label}
                </span>
              )}
            </label>
            <div className="qa-output-content">
              {isProcessing ? (
                <AILabProgress
                  label={`Running ${selectedAction?.label || 'AI'}...`}
                  accentColor="#fbbf24"
                  accentRgb="251, 191, 36"
                />
              ) : outputText ? (
                <AILabOutput
                  content={outputText}
                  accentColor="#fbbf24"
                  accentRgb="251, 191, 36"
                  label={selectedAction?.label}
                  onShare={teamChannels.length > 0 && currentUser ? () => setShowShare(true) : undefined}
                />
              ) : (
                <AILabEmptyState
                  icon="fa-wand-magic-sparkles"
                  title="Select an action"
                  description="Choose from 12 AI actions or use ⌘K to search"
                  accentColor="#fbbf24"
                  accentRgb="251, 191, 36"
                />
              )}
            </div>
            {outputText && !isProcessing && (
              <div className="qa-output-footer">
                <button type="button" onClick={() => { setInputText(outputText); setOutputText(''); setSelectedAction(null); showToast('Output moved to input', 'info'); }}>
                  <ArrowRight />
                  Use as Input
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions Panel */}
        <div className="qa-sidebar">
          {/* Recent Actions */}
          <div className="qa-section">
            <h4>Recent</h4>
            <div className="qa-recent">
              {recentActions.map(actionId => {
                const action = QUICK_ACTIONS.find(a => a.id === actionId);
                if (!action) return null;
                return (
                  <button
                    key={action.id}
                    type="button"
                    className={`qa-recent-btn qa-color-${action.color}`}
                    onClick={() => executeAction(action)}
                  >
                    <i className={`fa-solid ${action.icon}`}></i>
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Categories */}
          <div className="qa-section">
            <h4>Categories</h4>
            <div className="qa-categories">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  className={`qa-category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <i className={`fa-solid ${cat.icon}`}></i>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* All Actions */}
          <div className="qa-section qa-actions-section">
            <h4>Actions</h4>
            <div className="qa-actions-grid">
              {filteredActions.map(action => {
                const colors = COLOR_MAP[action.color] || COLOR_MAP.indigo;
                return (
                  <button
                    key={action.id}
                    type="button"
                    className={`qa-action-btn qa-color-${action.color} ${selectedAction?.id === action.id ? 'active' : ''}`}
                    onClick={() => executeAction(action)}
                    title={action.description}
                    style={{ '--action-color': colors.hex, '--action-color-rgb': colors.rgb } as React.CSSProperties}
                  >
                    <div className="qa-action-icon">
                      <i className={`fa-solid ${action.icon}`}></i>
                    </div>
                    <div className="qa-action-info">
                      <span className="qa-action-label">{action.label}</span>
                      <span className="qa-action-shortcut">{action.shortcut}</span>
                    </div>
                    <span className="qa-action-desc">{action.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showShare && outputText && (
        <ShareToChannelModal
          title={selectedAction ? `${selectedAction.label}: AI Output` : 'Quick Action Output'}
          content={outputText}
          onClose={() => setShowShare(false)}
        />
      )}
      {ToastComponent}
    </div>
  );
};

export default QuickActions;
