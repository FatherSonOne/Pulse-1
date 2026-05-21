// FloatingToolsButton — flat popup variant.
// The old radial menu types (ToolCategory, ToolCategorySegmentProps,
// ToolSubMenuProps) were removed when the menu was flattened. Tool
// listings now come straight from services/toolRegistry.

export interface FloatingToolsButtonProps {
  setActiveToolOverlay?: (
    overlayType:
      | 'analytics'
      | 'collaboration'
      | 'productivity'
      | 'intelligence'
      | 'proactive'
      | 'communication'
      | 'personalization'
      | 'security'
      | 'mediaHub',
  ) => void;
}
