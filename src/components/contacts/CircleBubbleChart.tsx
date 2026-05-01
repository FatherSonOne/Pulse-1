// ============================================
// CIRCLE BUBBLE CHART
// Physics-based bubble cluster visualization for contact circles.
// Pure React + requestAnimationFrame — no d3 dependency.
// ============================================

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AnimatedIcon } from '../ui/AnimatedIcon';
import { ContactCircle } from '../../types/contactCircleTypes';
import { Contact } from '../../types';
import { getRelationshipHealthColor } from '../../types/relationshipTypes';
import { RelationshipProfile } from '../../types/relationshipTypes';

// ==================== TYPES ====================

interface BubbleState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  circle: ContactCircle;
}

interface CircleBubbleChartProps {
  circles: ContactCircle[];
  contacts: Contact[];
  profiles: RelationshipProfile[];
  onCircleClick: (circle: ContactCircle) => void;
  onContactClick?: (contact: Contact) => void;
  width: number;
  height: number;
}

// ==================== HELPERS ====================

function bubbleRadius(memberCount: number): number {
  // Scale radius with sqrt of member count, clamped. Coerce non-numeric / NaN
  // input to 0 so the result is always a finite length the SVG layout accepts.
  const n = Number.isFinite(memberCount) ? memberCount : 0;
  return Math.max(48, Math.min(110, 40 + Math.sqrt(Math.max(0, n)) * 16));
}

function getHealthGlow(healthScore?: number): string {
  if (healthScore === undefined) return 'rgba(99,102,241,0.15)';
  if (healthScore >= 70) return 'rgba(34,197,94,0.2)';
  if (healthScore >= 40) return 'rgba(234,179,8,0.2)';
  return 'rgba(239,68,68,0.15)';
}

function getHealthBorder(healthScore?: number): string {
  if (healthScore === undefined) return '#6366f1';
  if (healthScore >= 70) return '#22c55e';
  if (healthScore >= 40) return '#eab308';
  return '#ef4444';
}

// Simple mini-avatar initials for members shown inside large bubbles
function memberInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

// ==================== FORCE SIMULATION ====================

function initBubbles(circles: ContactCircle[], width: number, height: number): BubbleState[] {
  // Guard against zero/NaN container size so x,y stay finite — a transiently
  // unmeasured container would otherwise produce NaN translates and downstream
  // <circle cx="undefined"> warnings.
  const w = Number.isFinite(width) && width > 0 ? width : 600;
  const h = Number.isFinite(height) && height > 0 ? height : 440;
  return circles.map((circle, i) => {
    const angle = (i / Math.max(1, circles.length)) * Math.PI * 2;
    const spread = Math.min(w, h) * 0.28;
    return {
      id: circle.id,
      x: w / 2 + Math.cos(angle) * spread,
      y: h / 2 + Math.sin(angle) * spread,
      vx: 0,
      vy: 0,
      radius: bubbleRadius(circle.memberContactIds?.length ?? 0),
      circle,
    };
  });
}

function applyForces(
  bubbles: BubbleState[],
  width: number,
  height: number
): BubbleState[] {
  const cx = width / 2;
  const cy = height / 2;
  const damping = 0.82;
  const centerStrength = 0.015;
  const repelStrength = 1.8;
  const padding = 12;

  const next = bubbles.map(b => ({ ...b }));

  // Center gravity
  for (const b of next) {
    b.vx += (cx - b.x) * centerStrength;
    b.vy += (cy - b.y) * centerStrength;
  }

  // Collision repulsion
  for (let i = 0; i < next.length; i++) {
    for (let j = i + 1; j < next.length; j++) {
      const a = next[i];
      const b = next[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const minDist = a.radius + b.radius + padding;
      if (dist < minDist) {
        const force = ((minDist - dist) / dist) * repelStrength * 0.5;
        a.vx -= dx * force;
        a.vy -= dy * force;
        b.vx += dx * force;
        b.vy += dy * force;
      }
    }
  }

  // Wall bounds
  for (const b of next) {
    if (b.x - b.radius < 8) b.vx += (8 + b.radius - b.x) * 0.3;
    if (b.x + b.radius > width - 8) b.vx -= (b.x + b.radius - (width - 8)) * 0.3;
    if (b.y - b.radius < 8) b.vy += (8 + b.radius - b.y) * 0.3;
    if (b.y + b.radius > height - 8) b.vy -= (b.y + b.radius - (height - 8)) * 0.3;
  }

  // Integrate + dampen
  for (const b of next) {
    b.vx *= damping;
    b.vy *= damping;
    b.x += b.vx;
    b.y += b.vy;
  }

  return next;
}

// ==================== COMPONENT ====================

export const CircleBubbleChart: React.FC<CircleBubbleChartProps> = ({
  circles,
  contacts,
  profiles,
  onCircleClick,
  onContactClick,
  width,
  height,
}) => {
  const [bubbles, setBubbles] = useState<BubbleState[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoomedCircleId, setZoomedCircleId] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const bubblesRef = useRef<BubbleState[]>([]);
  const stepsRef = useRef(0);

  // Contact + profile lookup maps
  const contactMap = new Map(contacts.map(c => [c.id, c]));
  const profileByEmail = new Map(profiles.map(p => [p.contactEmail.toLowerCase(), p]));

  // (Re)initialise when circles change
  useEffect(() => {
    const initial = initBubbles(circles, width, height);
    bubblesRef.current = initial;
    setBubbles(initial);
    stepsRef.current = 0;
  }, [circles, width, height]);

  // Skip render entirely until the parent has measured a real size — emitting
  // SVG circles into an unmeasured container produces non-finite cx/cy.
  const containerReady = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;

  // Run simulation
  useEffect(() => {
    const MAX_STEPS = 180; // settle after ~3 seconds at 60fps

    function tick() {
      if (stepsRef.current >= MAX_STEPS) return;
      bubblesRef.current = applyForces(bubblesRef.current, width, height);
      setBubbles([...bubblesRef.current]);
      stepsRef.current++;
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [circles, width, height]);

  const handleBubbleClick = useCallback((bubble: BubbleState) => {
    if (zoomedCircleId === bubble.id) {
      setZoomedCircleId(null); // un-zoom
    } else {
      setZoomedCircleId(bubble.id);
      onCircleClick(bubble.circle);
    }
  }, [zoomedCircleId, onCircleClick]);

  if (!containerReady) return null;

  // Empty state
  if (circles.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{ width, height }}
      >
        <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-4">
          <AnimatedIcon icon="network" size={32} />
        </div>
        <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300 mb-1">No circles yet</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-[200px] leading-relaxed">
          Create circles to organise your network, or let AI detect them automatically.
        </p>
      </div>
    );
  }

  const zoomedBubble = zoomedCircleId ? bubbles.find(b => b.id === zoomedCircleId) : null;

  return (
    <div className="relative select-none" style={{ width, height }}>
      <svg width={width} height={height} className="absolute inset-0">
        <defs>
          {bubbles.map(b => (
            <radialGradient key={b.id} id={`glow-${b.id}`} cx="50%" cy="35%" r="65%">
              <stop offset="0%" stopColor={b.circle.color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={b.circle.color} stopOpacity="0.05" />
            </radialGradient>
          ))}
        </defs>

        {/* Bubble circles */}
        {bubbles.map(b => {
          const isHovered = hoveredId === b.id;
          const isZoomed = zoomedCircleId === b.id;
          const healthBorder = getHealthBorder(b.circle.healthScore);
          const scale = isZoomed ? 1.12 : isHovered ? 1.06 : 1;

          return (
            <g
              key={b.id}
              transform={`translate(${b.x}, ${b.y}) scale(${scale})`}
              style={{ transition: 'transform 0.2s ease', cursor: 'pointer' }}
              onClick={() => handleBubbleClick(b)}
              onMouseEnter={() => setHoveredId(b.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Glow halo */}
              <circle
                r={b.radius + 8}
                fill={`url(#glow-${b.id})`}
                opacity={isHovered || isZoomed ? 1 : 0.6}
              />

              {/* Main circle */}
              <circle
                r={b.radius}
                fill={`${b.circle.color}22`}
                stroke={isZoomed ? b.circle.color : healthBorder}
                strokeWidth={isZoomed ? 3 : 2}
                strokeDasharray={b.circle.source === 'auto' ? '6 3' : undefined}
              />

              {/* Circle name */}
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                y={b.radius > 64 ? -12 : 0}
                fontSize={b.radius > 80 ? 13 : 11}
                fontWeight="600"
                fill="currentColor"
                className="fill-zinc-700 dark:fill-zinc-200"
              >
                {b.circle.name.length > 14 ? b.circle.name.slice(0, 13) + '…' : b.circle.name}
              </text>

              {/* Member count badge */}
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                y={b.radius > 64 ? 8 : 16}
                fontSize={9}
                className="fill-zinc-500 dark:fill-zinc-400"
              >
                {b.circle.memberContactIds.length} member{b.circle.memberContactIds.length !== 1 ? 's' : ''}
              </text>

              {/* Health score dot (top-right) */}
              {b.circle.healthScore !== undefined && (
                <circle
                  cx={b.radius * 0.7}
                  cy={-b.radius * 0.7}
                  r={7}
                  fill={healthBorder}
                  opacity={0.9}
                />
              )}

              {/* Auto-detected badge */}
              {b.circle.source === 'auto' && (
                <text
                  textAnchor="middle"
                  y={b.radius - 10}
                  fontSize={8}
                  className="fill-indigo-500 dark:fill-indigo-400"
                >
                  AI
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Zoom overlay: show member mini-avatars when a circle is zoomed */}
      {zoomedBubble && (
        <div
          className="absolute z-10 pointer-events-none"
          style={{
            left: zoomedBubble.x - zoomedBubble.radius,
            top: zoomedBubble.y - zoomedBubble.radius,
            width: zoomedBubble.radius * 2,
            height: zoomedBubble.radius * 2,
          }}
        >
          <div className="w-full h-full flex flex-wrap items-center justify-center gap-1 p-4 pointer-events-auto">
            {zoomedBubble.circle.memberContactIds.slice(0, 9).map(cid => {
              const contact = contactMap.get(cid);
              if (!contact) return null;
              const profile = profileByEmail.get(contact.email?.toLowerCase() ?? '');
              const ringColor = profile
                ? getRelationshipHealthColor(profile.relationshipScore)
                : '#6b7280';
              return (
                <button
                  key={cid}
                  onClick={() => onContactClick?.(contact)}
                  className="flex flex-col items-center gap-0.5 group"
                  title={contact.name}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{
                      backgroundColor: contact.avatarColor || '#6366f1',
                      boxShadow: `0 0 0 2px ${ringColor}`,
                    }}
                  >
                    {memberInitial(contact.name)}
                  </div>
                  <span className="text-[9px] text-zinc-600 dark:text-zinc-300 leading-none max-w-[28px] truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {contact.name.split(' ')[0]}
                  </span>
                </button>
              );
            })}
            {zoomedBubble.circle.memberContactIds.length > 9 && (
              <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs text-zinc-500 font-medium">
                +{zoomedBubble.circle.memberContactIds.length - 9}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tooltip on hover */}
      {hoveredId && !zoomedCircleId && (() => {
        const b = bubbles.find(bub => bub.id === hoveredId);
        if (!b) return null;
        return (
          <div
            className="absolute z-20 pointer-events-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 shadow-lg text-xs"
            style={{
              left: Math.min(b.x + b.radius + 8, width - 160),
              top: Math.max(b.y - 30, 8),
            }}
          >
            <div className="font-semibold text-zinc-800 dark:text-zinc-100">{b.circle.name}</div>
            <div className="text-zinc-500 dark:text-zinc-400 mt-0.5">
              {b.circle.memberContactIds.length} contacts
              {b.circle.healthScore !== undefined && (
                <span className="ml-2" style={{ color: getHealthBorder(b.circle.healthScore) }}>
                  ● {b.circle.healthScore} health
                </span>
              )}
            </div>
            {b.circle.description && (
              <div className="text-zinc-400 mt-0.5 max-w-[150px] truncate">{b.circle.description}</div>
            )}
            <div className="text-zinc-400 mt-1">Click to expand</div>
          </div>
        );
      })()}
    </div>
  );
};

export default CircleBubbleChart;
