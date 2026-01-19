// Phase 2: AI-Powered Features Bundle
// This bundle contains AI-driven features that enhance message composition and understanding
// Lazy loaded on-demand when AI features are activated

import { SmartCompose } from './SmartCompose';
import { AICoach } from './AICoach';
import { SmartComposeEnhanced, QuickPhrases, ToneAdjuster } from './SmartComposeEnhanced';
import { AICoachEnhanced, InlineCoachTip } from './AICoachEnhanced';
import { AIMediatorPanel, MediatorIndicator } from './AIMediatorPanel';
import { VoiceContextExtractor } from './VoiceContextExtractor';
import { TranslationWidgetEnhanced, TranslationIndicator, AutoTranslateToggle } from './TranslationWidgetEnhanced';

// Export as default object for lazy loading
export default {
  SmartCompose,
  AICoach,
  SmartComposeEnhanced,
  QuickPhrases,
  ToneAdjuster,
  AICoachEnhanced,
  InlineCoachTip,
  AIMediatorPanel,
  MediatorIndicator,
  VoiceContextExtractor,
  TranslationWidgetEnhanced,
  TranslationIndicator,
  AutoTranslateToggle,
};
