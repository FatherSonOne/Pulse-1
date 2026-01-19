// src/components/Email/index.tsx
// New AI-powered email client
export { PulseEmailClient } from './PulseEmailClient';
export { EmailSidebar } from './EmailSidebar';
export { EmailList } from './EmailList';
export { EmailViewerNew } from './EmailViewerNew';
export { EmailComposerModal } from './EmailComposerModal';
export { EmailClientWrapper } from './EmailClientWrapper';

// Legacy components (for backwards compatibility)
export { EnhancedEmailClient } from './EnhancedEmailClient';
export { EmailViewer } from './EmailViewer';
export { EmailComposer } from './EmailComposer';

// Default export is wrapper for App.tsx compatibility
export { default } from './EmailClientWrapper';
