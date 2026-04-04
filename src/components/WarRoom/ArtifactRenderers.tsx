/**
 * ArtifactRenderers.tsx — Rich inline renderers for each artifact type.
 *
 * These replace raw markdown with interactive, on-brand UI cards that render
 * inside the chat canvas. Each renderer is self-contained and uses PS design tokens.
 */

import React, { useState } from 'react';
import {
  Artifact,
  ArtifactSummary,
  ArtifactProsCons,
  ArtifactActionItems,
  ArtifactDecisionMatrix,
  ArtifactIdeas,
  ArtifactTimeline,
  ArtifactRiskAssessment,
} from './artifactParser';
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, ChevronRight,
  Circle, Lightbulb, ListChecks, Minus, Pin, Plus, Sparkles,
  ThumbsUp, X,
} from 'lucide-react';
import type { NoteType, BoardNoteMeta } from './useBoardNotes';

// ── Shared ─────────────────────────────────────────────────────────────────────

interface ArtifactCardProps {
  icon: React.ReactNode;
  label: string;
  accent: string;
  onPin?: (content: string, type: NoteType) => void;
  pinContent?: string;
  pinType?: NoteType;
  children: React.ReactNode;
}

const ArtifactCard: React.FC<ArtifactCardProps> = ({
  icon, label, accent, onPin, pinContent, pinType = 'finding', children,
}) => (
  <div className="ps-artifact-card" style={{ '--artifact-accent': accent } as React.CSSProperties}>
    <div className="ps-artifact-card-header">
      <div className="ps-artifact-card-badge" style={{ background: `${accent}18`, color: accent }}>
        {icon}
        <span>{label}</span>
      </div>
      {onPin && pinContent && (
        <button
          className="ps-artifact-pin-btn"
          onClick={() => onPin(pinContent, pinType)}
          title="Pin to Artifacts"
        >
          <Pin size={12} />
        </button>
      )}
    </div>
    {children}
  </div>
);

// ── Summary ────────────────────────────────────────────────────────────────────

const SummaryRenderer: React.FC<{ data: ArtifactSummary; onPin?: (c: string, t: NoteType) => void }> = ({ data, onPin }) => (
  <ArtifactCard
    icon={<Sparkles size={13} />}
    label={data.title}
    accent="#f43f5e"
    onPin={onPin}
    pinContent={data.points.map((p, i) => `${i + 1}. ${p}`).join('\n')}
    pinType="insight"
  >
    <ul className="ps-artifact-list">
      {data.points.map((point, i) => (
        <li key={i}>
          <ChevronRight size={12} className="ps-artifact-list-icon" style={{ color: '#f43f5e' }} />
          <span>{point}</span>
        </li>
      ))}
    </ul>
  </ArtifactCard>
);

// ── Pros & Cons ────────────────────────────────────────────────────────────────

const ProsConsRenderer: React.FC<{ data: ArtifactProsCons; onPin?: (c: string, t: NoteType) => void }> = ({ data, onPin }) => (
  <ArtifactCard
    icon={<Minus size={13} />}
    label={data.title}
    accent="#8b5cf6"
    onPin={onPin}
    pinContent={`Pros:\n${data.pros.map(p => `+ ${p}`).join('\n')}\n\nCons:\n${data.cons.map(c => `- ${c}`).join('\n')}`}
    pinType="finding"
  >
    <div className="ps-artifact-proscons">
      <div className="ps-artifact-proscons-col ps-artifact-proscons-col--pro">
        <div className="ps-artifact-proscons-label" style={{ color: '#10b981' }}>
          <Plus size={12} /> Pros
        </div>
        {data.pros.map((p, i) => (
          <div key={i} className="ps-artifact-proscons-item">
            <Check size={12} style={{ color: '#10b981', flexShrink: 0 }} />
            <span>{p}</span>
          </div>
        ))}
      </div>
      <div className="ps-artifact-proscons-divider" />
      <div className="ps-artifact-proscons-col ps-artifact-proscons-col--con">
        <div className="ps-artifact-proscons-label" style={{ color: '#ef4444' }}>
          <X size={12} /> Cons
        </div>
        {data.cons.map((c, i) => (
          <div key={i} className="ps-artifact-proscons-item">
            <X size={12} style={{ color: '#ef4444', flexShrink: 0 }} />
            <span>{c}</span>
          </div>
        ))}
      </div>
    </div>
  </ArtifactCard>
);

// ── Action Items ───────────────────────────────────────────────────────────────

const ActionItemsRenderer: React.FC<{ data: ArtifactActionItems; onPin?: (c: string, t: NoteType) => void }> = ({ data, onPin }) => {
  const [items, setItems] = useState(data.items);

  const toggleItem = (idx: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, done: !item.done } : item));
  };

  return (
    <ArtifactCard
      icon={<ListChecks size={13} />}
      label={data.title}
      accent="#10b981"
      onPin={onPin}
      pinContent={items.map(i => `${i.done ? '[x]' : '[ ]'} ${i.text}`).join('\n')}
      pinType="action"
    >
      <div className="ps-artifact-actions">
        {items.map((item, i) => (
          <button
            key={i}
            className={`ps-artifact-action-item ${item.done ? 'ps-artifact-action-item--done' : ''}`}
            onClick={() => toggleItem(i)}
          >
            <div className="ps-artifact-action-check">
              {item.done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
            </div>
            <span>{item.text}</span>
          </button>
        ))}
      </div>
    </ArtifactCard>
  );
};

// ── Decision Matrix ────────────────────────────────────────────────────────────

const DecisionMatrixRenderer: React.FC<{ data: ArtifactDecisionMatrix; onPin?: (c: string, t: NoteType) => void }> = ({ data, onPin }) => (
  <ArtifactCard
    icon={<ListChecks size={13} />}
    label={data.title}
    accent="#3b82f6"
    onPin={onPin}
    pinContent={`${data.headers.join(' | ')}\n${data.rows.map(r => r.join(' | ')).join('\n')}`}
    pinType="decision"
  >
    <div className="ps-artifact-table-wrap">
      <table className="ps-artifact-table">
        <thead>
          <tr>
            {data.headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </ArtifactCard>
);

// ── Ideas ──────────────────────────────────────────────────────────────────────

const IdeasRenderer: React.FC<{ data: ArtifactIdeas; onPin?: (c: string, t: NoteType) => void }> = ({ data, onPin }) => {
  const [ideas, setIdeas] = useState(data.ideas);

  const upvote = (idx: number) => {
    setIdeas(prev => prev.map((idea, i) => i === idx ? { ...idea, votes: idea.votes + 1 } : idea));
  };

  return (
    <ArtifactCard
      icon={<Lightbulb size={13} />}
      label={data.title}
      accent="#f59e0b"
      onPin={onPin}
      pinContent={ideas.map(i => `- ${i.text}`).join('\n')}
      pinType="insight"
    >
      <div className="ps-artifact-ideas">
        {ideas.map((idea, i) => (
          <div key={i} className="ps-artifact-idea">
            <div className="ps-artifact-idea-text">
              <Lightbulb size={12} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
              <span>{idea.text}</span>
            </div>
            <button className="ps-artifact-idea-vote" onClick={() => upvote(i)}>
              <ThumbsUp size={11} />
              {idea.votes > 0 && <span>{idea.votes}</span>}
            </button>
          </div>
        ))}
      </div>
    </ArtifactCard>
  );
};

// ── Timeline ───────────────────────────────────────────────────────────────────

const TimelineRenderer: React.FC<{ data: ArtifactTimeline; onPin?: (c: string, t: NoteType) => void }> = ({ data, onPin }) => (
  <ArtifactCard
    icon={<ArrowRight size={13} />}
    label={data.title}
    accent="#6366f1"
    onPin={onPin}
    pinContent={data.events.map(e => `${e.label}: ${e.description}`).join('\n')}
    pinType="finding"
  >
    <div className="ps-artifact-timeline">
      {data.events.map((event, i) => (
        <div key={i} className="ps-artifact-timeline-item">
          <div className="ps-artifact-timeline-dot">
            <div className="ps-artifact-timeline-dot-inner" />
            {i < data.events.length - 1 && <div className="ps-artifact-timeline-line" />}
          </div>
          <div className="ps-artifact-timeline-content">
            <div className="ps-artifact-timeline-label">{event.label}</div>
            <div className="ps-artifact-timeline-desc">{event.description}</div>
          </div>
        </div>
      ))}
    </div>
  </ArtifactCard>
);

// ── Risk Assessment ────────────────────────────────────────────────────────────

const RiskRenderer: React.FC<{ data: ArtifactRiskAssessment; onPin?: (c: string, t: NoteType) => void }> = ({ data, onPin }) => (
  <ArtifactCard
    icon={<AlertTriangle size={13} />}
    label={data.title}
    accent="#ef4444"
    onPin={onPin}
    pinContent={data.risks.map(r => `⚠ ${r.risk}${r.mitigation ? ` → ${r.mitigation}` : ''}`).join('\n')}
    pinType="finding"
  >
    <div className="ps-artifact-risks">
      {data.risks.map((risk, i) => (
        <div key={i} className="ps-artifact-risk-row">
          <div className="ps-artifact-risk-name">
            <AlertTriangle size={12} style={{ color: '#ef4444', flexShrink: 0 }} />
            <span>{risk.risk}</span>
          </div>
          {(risk.likelihood || risk.impact) && (
            <div className="ps-artifact-risk-meta">
              {risk.likelihood && <span className="ps-artifact-risk-badge ps-artifact-risk-badge--likelihood">{risk.likelihood}</span>}
              {risk.impact && <span className="ps-artifact-risk-badge ps-artifact-risk-badge--impact">{risk.impact}</span>}
            </div>
          )}
          {risk.mitigation && (
            <div className="ps-artifact-risk-mitigation">
              <ArrowRight size={10} /> {risk.mitigation}
            </div>
          )}
        </div>
      ))}
    </div>
  </ArtifactCard>
);

// ── Dispatcher ─────────────────────────────────────────────────────────────────

export const InlineArtifact: React.FC<{
  artifact: Artifact;
  onPin?: (content: string, type: NoteType) => void;
}> = ({ artifact, onPin }) => {
  switch (artifact.type) {
    case 'summary':          return <SummaryRenderer data={artifact} onPin={onPin} />;
    case 'pros-cons':        return <ProsConsRenderer data={artifact} onPin={onPin} />;
    case 'action-items':     return <ActionItemsRenderer data={artifact} onPin={onPin} />;
    case 'decision-matrix':  return <DecisionMatrixRenderer data={artifact} onPin={onPin} />;
    case 'ideas':            return <IdeasRenderer data={artifact} onPin={onPin} />;
    case 'timeline':         return <TimelineRenderer data={artifact} onPin={onPin} />;
    case 'risk-assessment':  return <RiskRenderer data={artifact} onPin={onPin} />;
    default:                 return null;
  }
};
