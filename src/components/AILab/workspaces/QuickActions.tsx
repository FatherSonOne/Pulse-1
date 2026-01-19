import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../shared/WorkspaceContext';
import './QuickActions.css';

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

const QuickActions: React.FC<QuickActionsProps> = ({ onBack, apiKey }) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [selectedAction, setSelectedAction] = useState<QuickAction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentActions, setRecentActions] = useState<string[]>(['summarize', 'email', 'analyze']);

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

    // Simulate AI processing
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));

    // Generate mock output based on action
    const mockOutputs: Record<string, string> = {
      summarize: `**Summary:**\n\n${inputText.split(' ').slice(0, 20).join(' ')}...\n\n• Key point 1 extracted from content\n• Key point 2 with relevant details\n• Key point 3 summarizing main idea`,
      expand: `${inputText}\n\n**Additional Context:**\n\nBuilding on the points above, it's important to consider the broader implications. This expansion provides more depth and nuance to the original content, adding supporting details and examples.`,
      translate: `**Translated to Spanish:**\n\nEste es un texto de ejemplo traducido. [Translation of your content would appear here with accurate language conversion.]`,
      rewrite: `**Improved Version:**\n\n${inputText.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}\n\n*Enhanced for clarity and professional tone*`,
      analyze: `**Analysis Results:**\n\n📊 **Sentiment:** Positive (78%)\n📝 **Word Count:** ${inputText.split(' ').length}\n🎯 **Key Themes:** Business, Strategy, Growth\n💡 **Recommendations:** Consider adding more specific data points`,
      extract: `**Extracted Data:**\n\n| Field | Value |\n|-------|-------|\n| Topic | Business |\n| Entities | 3 identified |\n| Dates | None found |\n| Actions | 2 mentioned |`,
      email: `**Draft Email:**\n\nSubject: Follow-up on Our Discussion\n\nDear [Recipient],\n\n${inputText}\n\nPlease let me know if you have any questions.\n\nBest regards,\n[Your Name]`,
      reply: `**Suggested Reply:**\n\nThank you for your message. I've reviewed the information you shared and would like to provide my thoughts:\n\n${inputText.split(' ').slice(0, 15).join(' ')}...\n\nI look forward to discussing this further.`,
      tasks: `**Action Items:**\n\n☐ Task 1: Review the key points\n☐ Task 2: Schedule follow-up meeting\n☐ Task 3: Prepare documentation\n☐ Task 4: Share findings with team`,
      explain: `**Explanation:**\n\n${inputText}\n\n**In Simple Terms:**\nThis concept can be understood as [simplified explanation]. Think of it like [analogy]. The main takeaway is [key insight].`,
      fix: `**Polished Version:**\n\n${inputText.charAt(0).toUpperCase() + inputText.slice(1).replace(/\s+/g, ' ').trim()}\n\n✅ Grammar corrected\n✅ Punctuation fixed\n✅ Style improved`,
      format: `**Formatted Content:**\n\n| # | Item | Details |\n|---|------|--------|\n| 1 | ${inputText.split(' ')[0] || 'Item'} | Description |\n| 2 | ${inputText.split(' ')[1] || 'Item'} | Description |\n| 3 | ${inputText.split(' ')[2] || 'Item'} | Description |`,
    };

    setOutputText(mockOutputs[action.id] || 'Action completed successfully.');
    setIsProcessing(false);
    
    // Update recent actions
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
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div className="qa-branding">
            <i className="fa-solid fa-bolt"></i>
            <span>Quick Actions</span>
          </div>
          <span className="qa-subtitle">Context-Aware AI Toolbar</span>
        </div>
        <div className="qa-header-right">
          <div className="qa-search">
            <i className="fa-solid fa-search"></i>
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
              <i className="fa-solid fa-keyboard"></i>
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
                <i className="fa-solid fa-eraser"></i>
                Clear
              </button>
            </div>
          </div>

          <div className="qa-output-section">
            <label>
              <i className="fa-solid fa-sparkles"></i>
              Output
              {selectedAction && (
                <span className="qa-output-action">
                  via {selectedAction.label}
                </span>
              )}
            </label>
            <div className="qa-output-content">
              {isProcessing ? (
                <div className="qa-processing">
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>Processing with AI...</span>
                </div>
              ) : outputText ? (
                <pre>{outputText}</pre>
              ) : (
                <div className="qa-output-empty">
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  <span>Select an action to transform your content</span>
                </div>
              )}
            </div>
            {outputText && !isProcessing && (
              <div className="qa-output-footer">
                <button onClick={() => navigator.clipboard.writeText(outputText)}>
                  <i className="fa-solid fa-copy"></i>
                  Copy
                </button>
                <button>
                  <i className="fa-solid fa-arrow-right"></i>
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
              {filteredActions.map(action => (
                <button
                  key={action.id}
                  className={`qa-action-btn qa-color-${action.color} ${selectedAction?.id === action.id ? 'active' : ''}`}
                  onClick={() => executeAction(action)}
                  title={action.description}
                >
                  <div className="qa-action-icon">
                    <i className={`fa-solid ${action.icon}`}></i>
                  </div>
                  <div className="qa-action-info">
                    <span className="qa-action-label">{action.label}</span>
                    <span className="qa-action-shortcut">{action.shortcut}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickActions;
