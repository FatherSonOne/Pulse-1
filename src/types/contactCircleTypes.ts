// ============================================
// CONTACT CIRCLE TYPES
// Types for the Circles network visualization feature.
// Part of: Contacts Reimagined — Phase 3
// ============================================

export type CircleSource = 'auto' | 'manual';

export interface ContactCircle {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color: string;         // hex color
  icon?: string;         // emoji or FA class
  source: CircleSource;  // 'auto' = AI-detected, 'manual' = user-created
  memberContactIds: string[];
  healthScore?: number;  // 0–100, aggregate of member relationship scores
  createdAt: string;
  updatedAt: string;
}

// DB row (snake_case)
export interface ContactCircleRow {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  source: string;
  health_score?: number;
  created_at: string;
  updated_at: string;
}

export interface ContactCircleMemberRow {
  circle_id: string;
  contact_id: string;
  added_at: string;
}

// ==================== BUBBLE CHART TYPES ====================

export interface BubbleNode {
  id: string;          // circle id
  label: string;
  color: string;
  icon?: string;
  memberCount: number;
  healthScore?: number;
  // Layout (set by physics engine)
  x: number;
  y: number;
  vx: number;          // velocity x
  vy: number;          // velocity y
  radius: number;
}

export interface MemberBubble {
  contactId: string;
  name: string;
  avatarColor: string;
  relationshipScore?: number;
  // Layout
  x: number;
  y: number;
  radius: number;
}

// ==================== PALETTE ====================

export const CIRCLE_COLOR_PALETTE = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#ef4444', // red
  '#14b8a6', // teal
  '#f97316', // orange
  '#84cc16', // lime
];

export function getCircleColorForIndex(index: number): string {
  return CIRCLE_COLOR_PALETTE[index % CIRCLE_COLOR_PALETTE.length];
}
