/**
 * Custom Event Types Service
 * Allows users to define their own event types beyond the built-in 10 types.
 * Persisted in localStorage.
 */

export interface CustomEventType {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: number;
  isCustom: true;
}

const STORAGE_KEY = 'pulse_custom_event_types';

// Built-in icon options users can choose from
export const AVAILABLE_ICONS = [
  { id: 'fa-calendar',        label: 'Calendar' },
  { id: 'fa-star',            label: 'Star' },
  { id: 'fa-bolt',            label: 'Lightning' },
  { id: 'fa-fire',            label: 'Fire' },
  { id: 'fa-leaf',            label: 'Leaf' },
  { id: 'fa-trophy',          label: 'Trophy' },
  { id: 'fa-graduation-cap',  label: 'Education' },
  { id: 'fa-briefcase',       label: 'Work' },
  { id: 'fa-house',           label: 'Home' },
  { id: 'fa-music',           label: 'Music' },
  { id: 'fa-palette',         label: 'Art' },
  { id: 'fa-camera',          label: 'Photo' },
  { id: 'fa-gamepad',         label: 'Gaming' },
  { id: 'fa-dumbbell',        label: 'Fitness' },
  { id: 'fa-utensils',        label: 'Food' },
  { id: 'fa-car',             label: 'Car' },
  { id: 'fa-dollar-sign',     label: 'Finance' },
  { id: 'fa-handshake',       label: 'Partnership' },
  { id: 'fa-lightbulb',       label: 'Idea' },
  { id: 'fa-rocket',          label: 'Launch' },
  { id: 'fa-tag',             label: 'Tag' },
  { id: 'fa-wrench',          label: 'Maintenance' },
  { id: 'fa-book',            label: 'Reading' },
  { id: 'fa-map-pin',         label: 'Location' },
];

// Preset color palette
export const AVAILABLE_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#84cc16', // Lime
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#64748b', // Slate
  '#78716c', // Stone
  '#a855f7', // Purple
  '#14b8a6', // Teal
  '#f43f5e', // Rose
  '#0ea5e9', // Sky
];

class CustomEventTypesService {
  private types: CustomEventType[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.types = JSON.parse(stored);
      }
    } catch {
      this.types = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.types));
    } catch {
      // Ignore storage errors
    }
  }

  getAll(): CustomEventType[] {
    return [...this.types];
  }

  create(name: string, icon: string, color: string): CustomEventType {
    const type: CustomEventType = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: name.trim(),
      icon,
      color,
      createdAt: Date.now(),
      isCustom: true,
    };
    this.types.push(type);
    this.save();
    return type;
  }

  update(id: string, updates: Partial<Pick<CustomEventType, 'name' | 'icon' | 'color'>>): void {
    const idx = this.types.findIndex(t => t.id === id);
    if (idx !== -1) {
      this.types[idx] = { ...this.types[idx], ...updates };
      this.save();
    }
  }

  delete(id: string): void {
    this.types = this.types.filter(t => t.id !== id);
    this.save();
  }

  getById(id: string): CustomEventType | undefined {
    return this.types.find(t => t.id === id);
  }
}

export const customEventTypesService = new CustomEventTypesService();

// Built-in type metadata (shared across all views)
export const BUILT_IN_TYPE_META: Record<string, { color: string; icon: string; label: string }> = {
  event:    { color: '#6b7280', icon: 'fa-calendar',    label: 'Event' },
  meet:     { color: '#3b82f6', icon: 'fa-video',       label: 'Meeting' },
  call:     { color: '#10b981', icon: 'fa-phone',       label: 'Call' },
  focus:    { color: '#8b5cf6', icon: 'fa-brain',       label: 'Focus Time' },
  personal: { color: '#f59e0b', icon: 'fa-user',        label: 'Personal' },
  deadline: { color: '#ef4444', icon: 'fa-flag',        label: 'Deadline' },
  travel:   { color: '#06b6d4', icon: 'fa-plane',       label: 'Travel' },
  social:   { color: '#ec4899', icon: 'fa-users',       label: 'Social' },
  health:   { color: '#f97316', icon: 'fa-heart-pulse', label: 'Health' },
  reminder: { color: '#a3a3a3', icon: 'fa-bell',        label: 'Reminder' },
};

/**
 * Get merged type metadata (built-in + custom) for a given event type id.
 * Falls back to generic 'Event' meta if unknown.
 */
export const getEventTypeMeta = (type?: string): { color: string; icon: string; label: string } => {
  if (!type) return BUILT_IN_TYPE_META.event;
  if (BUILT_IN_TYPE_META[type]) return BUILT_IN_TYPE_META[type];
  // Check custom types
  const custom = customEventTypesService.getById(type);
  if (custom) return { color: custom.color, icon: custom.icon, label: custom.name };
  return BUILT_IN_TYPE_META.event;
};
