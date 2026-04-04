import React, { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';

export type AgentType = 'general' | 'skeptic' | 'scribe' | 'deep-diver';

export const AGENTS: { id: AgentType; name: string; icon: string; description: string; color: string }[] = [
  { id: 'general', name: 'General', icon: 'fa-lightbulb', description: 'Balanced AI assistant for any task', color: 'from-amber-500 to-yellow-500' },
  { id: 'skeptic', name: 'Skeptic', icon: 'fa-scale-balanced', description: 'Critical thinker, questions assumptions', color: 'from-purple-500 to-indigo-500' },
  { id: 'scribe', name: 'Scribe', icon: 'fa-pen-fancy', description: 'Note-taker and summarizer', color: 'from-emerald-500 to-teal-500' },
  { id: 'deep-diver', name: 'Deep Diver', icon: 'fa-microscope', description: 'In-depth analysis and research', color: 'from-blue-500 to-cyan-500' },
];

export const AgentSelector: React.FC<{
  activeAgent: AgentType;
  onAgentChange: (agent: AgentType) => void;
}> = ({ activeAgent, onAgentChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedAgent = AGENTS.find(a => a.id === activeAgent) || AGENTS[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="war-room-btn px-3 py-1.5 flex items-center gap-2"
        aria-label={`Select agent: ${selectedAgent.name}`}
      >
        <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${selectedAgent.color}`} />
        <i className={`fa ${selectedAgent.icon} text-sm`}></i>
        <span className="text-sm font-medium hidden sm:inline">{selectedAgent.name}</span>
        <i className={`fa fa-chevron-down text-xs war-room-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="absolute top-full right-0 mt-2 w-64 war-room-panel z-50 overflow-hidden"
        >
          <div className="text-xs war-room-text-secondary px-3 py-2 font-semibold uppercase tracking-wider border-b border-white/10">
            AI Agent Persona
          </div>
          <div className="p-1">
            {AGENTS.map(agent => (
              <button
                key={agent.id}
                onClick={() => {
                  onAgentChange(agent.id);
                  setIsOpen(false);
                }}
                className={`war-room-list-item w-full p-2.5 text-left ${activeAgent === agent.id ? 'active' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${agent.color} bg-opacity-20 flex items-center justify-center`}>
                    <i className={`fa ${agent.icon} text-sm ${activeAgent === agent.id ? 'text-white' : ''}`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{agent.name}</div>
                    <div className={`text-xs truncate ${activeAgent === agent.id ? 'text-white/70' : 'war-room-text-secondary'}`}>
                      {agent.description}
                    </div>
                  </div>
                  {activeAgent === agent.id && <Check className="fa text-xs" />}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
