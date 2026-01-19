// Phase 4: Collaboration & Advanced Features Bundle
// This bundle contains thread collaboration, linking, and knowledge management
// Lazy loaded when collaboration features are used

import { ThreadCollaboration, ParticipantAvatars } from './ThreadCollaboration';
import { ThreadLinking, ThreadReferenceBadge } from './ThreadLinking';
import { KnowledgeBase, KnowledgeSuggestionChip } from './KnowledgeBase';
import { AdvancedSearch } from './AdvancedSearch';
import { MessagePinning, PinButton, HighlightToolbar } from './MessagePinning';
import { CollaborativeAnnotations, AnnotationButton, QuickAnnotationCreator } from './CollaborativeAnnotations';

// Export as default object for lazy loading
export default {
  ThreadCollaboration,
  ParticipantAvatars,
  ThreadLinking,
  ThreadReferenceBadge,
  KnowledgeBase,
  KnowledgeSuggestionChip,
  AdvancedSearch,
  MessagePinning,
  PinButton,
  HighlightToolbar,
  CollaborativeAnnotations,
  AnnotationButton,
  QuickAnnotationCreator,
};
