// FloatingToolsButton Types

export interface ToolCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  tools: string[]; // Array of tool IDs
}

export interface ToolCategorySegmentProps {
  category: ToolCategory;
  isSelected: boolean;
  onClick: () => void;
  position: 'top-right' | 'top-left' | 'bottom-left' | 'bottom-right';
}

export interface ToolSubMenuProps {
  category: ToolCategory;
  tools: ToolAction[];
  onToolClick: (toolId: string) => void;
  onClose: () => void;
}

export interface ToolAction {
  id: string;
  name: string;
  description: string;
  icon: string;
  color?: string;
  category?: string;
  shortcut?: string;
}

export interface FloatingToolsButtonProps {
  setActiveToolOverlay?: (overlayType: 'analytics' | 'collaboration' | 'productivity' | 'intelligence' | 'proactive' | 'communication' | 'personalization' | 'security' | 'mediaHub') => void;
}
