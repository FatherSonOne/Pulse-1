/**
 * GeneratorRail — visible launcher for the Studio capabilities (handoff Phase 5, P0).
 *
 * Surfaces the engine's generators + advanced AI as inviting cards instead of
 * hiding them behind ⌘K / modal flags. Every card dispatches through the
 * canonical store flags (rendered by WarRoomModalStack) — a single dispatch
 * path. Comparative Analysis + Knowledge Graph both open the AdvancedAI panel
 * (its tabs), which also wires the formerly-orphaned `showAdvancedAI` trigger.
 *
 * Coral budget: generator icons are AI-output surfaces → coral; the card
 * chrome stays neutral (CLAUDE.md §4 / invariant 4).
 */

import React from 'react';
import { useWarRoomStore } from '../../../store/warRoomStore';
import { BookOpen, HelpCircle, Clock, Mic, Scale, Share2, ChevronRight } from 'lucide-react';

interface GenCard {
  id: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  advanced?: boolean;
  open: () => void;
}

export interface GeneratorRailProps {
  /** noop placeholder removed — StudioPane renders the source hint. */
}

export const GeneratorRail: React.FC<GeneratorRailProps> = () => {
  const setShowStudyGuide = useWarRoomStore((s) => s.setShowStudyGuide);
  const setShowFAQ = useWarRoomStore((s) => s.setShowFAQ);
  const setShowTimeline = useWarRoomStore((s) => s.setShowTimeline);
  const setShowPodcast = useWarRoomStore((s) => s.setShowPodcast);
  const setShowAdvancedAI = useWarRoomStore((s) => s.setShowAdvancedAI);
  const setAdvancedAIView = useWarRoomStore((s) => s.setAdvancedAIView);

  const cards: GenCard[] = [
    { id: 'study-guide', label: 'Study Guide', desc: 'Structured notes & flashcards', icon: <BookOpen size={16} />, open: () => setShowStudyGuide(true) },
    { id: 'faq', label: 'FAQ', desc: 'Questions from your sources', icon: <HelpCircle size={16} />, open: () => setShowFAQ(true) },
    { id: 'timeline', label: 'Timeline', desc: 'Chronological events', icon: <Clock size={16} />, open: () => setShowTimeline(true) },
    { id: 'podcast', label: 'Podcast', desc: 'Two-host dialogue script', icon: <Mic size={16} />, open: () => setShowPodcast(true) },
    { id: 'comparative', label: 'Comparative Analysis', desc: 'Compare across sources', icon: <Scale size={16} />, advanced: true, open: () => { setAdvancedAIView('compare'); setShowAdvancedAI(true); } },
    { id: 'knowledge-graph', label: 'Knowledge Graph', desc: 'Entities & relationships', icon: <Share2 size={16} />, advanced: true, open: () => { setAdvancedAIView('graph'); setShowAdvancedAI(true); } },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={card.open}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '10px 12px',
              borderRadius: 'var(--ps-radius-md, 10px)',
              border: '1px solid var(--pulse-border)',
              background: 'var(--pulse-surface)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color var(--pulse-duration) var(--pulse-ease), background var(--pulse-duration) var(--pulse-ease)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--pulse-border-strong)';
              e.currentTarget.style.background = 'var(--pulse-surface-raised)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--pulse-border)';
              e.currentTarget.style.background = 'var(--pulse-surface)';
            }}
          >
            {/* Coral icon tile — AI-output surface */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 30,
                height: 30,
                borderRadius: 8,
                flexShrink: 0,
                background: 'var(--pulse-coral-bg-12)',
                color: 'var(--pulse-coral-fg)',
              }}
            >
              {card.icon}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pulse-ink)' }}>{card.label}</span>
                {card.advanced && (
                  <span
                    style={{
                      fontFamily: 'var(--pulse-font-mono)',
                      fontSize: 8,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      padding: '1px 4px',
                      borderRadius: 3,
                      background: 'var(--pulse-coral-bg-12)',
                      color: 'var(--pulse-coral-fg)',
                    }}
                  >
                    ADV
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--pulse-ink-3)', marginTop: 1 }}>{card.desc}</div>
            </div>
            <ChevronRight size={14} style={{ color: 'var(--pulse-ink-3)', flexShrink: 0 }} />
          </button>
        ))}
    </div>
  );
};

export default GeneratorRail;
