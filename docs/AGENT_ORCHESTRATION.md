# Pulse Messaging Enhancement - Agent Orchestration Guide

**Project:** Advanced AI Integration for Pulse Messaging Platform
**Version:** 1.0
**Date:** January 19, 2026
**Purpose:** Coordination guide for specialized agent deployment

---

## Overview

This document provides detailed instructions for spawning and coordinating specialized agents to implement the Pulse messaging enhancement project. Each agent has specific responsibilities, tools, and handoff protocols.

---

## Agent Deployment Strategy

### Phase 1: Foundation & UI Enhancement (Weeks 1-2)

Deploy agents **in parallel** for maximum efficiency:

#### Agent 1: UI Designer
**Spawn Command:**
```
Use Task tool with subagent_type: "UI Designer"
```

**Responsibilities:**
1. Design AI-augmented MessageInput component wireframes
2. Create visual design system for AI indicators (glow effects, pulse animations)
3. Design Tools panel reorganization with category structure
4. Create mobile-responsive layouts for all new components
5. Define color tokens for AI states (active, processing, confidence levels)

**Deliverables:**
- Figma/wireframes for MessageInput component
- AI visual indicator specifications (CSS classes, animations)
- Tools panel category structure
- Mobile UI patterns for bottom sheets and gestures
- Design tokens for [ai-messaging.css](f:/pulse1/src/styles/ai-messaging.css)

**Success Criteria:**
- All components have clear visual specifications
- Accessibility standards met (WCAG 2.1 AA)
- Dark mode first design maintained
- Mobile touch targets minimum 44x44px

**Handoff To:** Frontend Developer (wireframes → implementation)

---

#### Agent 2: Frontend Developer
**Spawn Command:**
```
Use Task tool with subagent_type: "Frontend Developer"
```

**Responsibilities:**
1. Extract MessageInput from [Messages.tsx](f:/pulse1/src/components/Messages.tsx)
2. Create new component: [MessageInput/AIComposer.tsx](f:/pulse1/src/components/MessageInput/AIComposer.tsx)
3. Implement smart compose with AI suggestions overlay
4. Add tone analyzer component
5. Integrate with existing `messageStore.analyzeDraft()` and `geminiService`
6. Create formatting toolbar with markdown support
7. Implement voice input integration
8. Add draft auto-save with visual indicators

**Technical Requirements:**
- Use Framer Motion for animations
- Debounce AI requests (300ms)
- Lazy load AI features with React.lazy()
- Follow existing component patterns from MessageChat.tsx
- Use CSS variables for theming
- Implement proper TypeScript types

**File Structure to Create:**
```
src/components/MessageInput/
├── MessageInput.tsx (main component)
├── AIComposer.tsx (AI suggestions overlay)
├── ToneAnalyzer.tsx (sentiment analysis)
├── FormattingToolbar.tsx (markdown toolbar)
├── AttachmentPreview.tsx (file preview)
├── MessageInput.css (component styles)
└── index.ts (exports)
```

**Integration Points:**
- Import and use in [Messages.tsx](f:/pulse1/src/components/Messages.tsx) line ~3887 (replace existing textarea)
- Connect to `useMessageStore()` for state management
- Use existing `useVoiceToText` hook
- Integrate with existing `DraftManager` component

**Success Criteria:**
- MessageInput renders correctly in Messages view
- AI suggestions appear within 500ms of typing
- Tone analysis updates in real-time
- Component is <30KB bundled
- Zero prop drilling (use Zustand store)
- Unit tests pass with >70% coverage

**Handoff From:** UI Designer (receive wireframes)
**Handoff To:** QA Engineer (component for testing)

---

#### Agent 3: Performance Engineer
**Spawn Command:**
```
Use Task tool with subagent_type: "engineering-senior-developer"
```

**Responsibilities:**
1. Implement code splitting for [Messages.tsx](f:/pulse1/src/components/Messages.tsx)
2. Configure Vite manual chunks in [vite.config.ts](f:/pulse1/vite.config.ts)
3. Create lazy-loaded feature bundles (AI, Analytics, Productivity)
4. Set up bundle size monitoring in CI
5. Optimize React performance (memo, useMemo, useCallback)
6. Implement virtual scrolling for message lists
7. Add performance budgets to Lighthouse CI

**Code Splitting Strategy:**
```typescript
// In Messages.tsx
const AIFeatures = lazy(() => import('./MessageEnhancements/AI'));
const AnalyticsFeatures = lazy(() => import('./MessageEnhancements/Analytics'));
const ProductivityFeatures = lazy(() => import('./MessageEnhancements/Productivity'));

// Vite config updates
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ai': ['openai', '@anthropic-ai/sdk', '@google/generative-ai'],
          'vendor-ui': ['framer-motion', 'lucide-react'],
          'message-enhancements-ai': [
            './src/components/MessageEnhancements/AICoachEnhanced',
            './src/components/MessageEnhancements/AIMediatorPanel',
            './src/components/MessageEnhancements/SmartCompose'
          ],
          'message-enhancements-analytics': [
            './src/components/MessageEnhancements/ConversationHealth',
            './src/components/MessageEnhancements/MessageImpact',
            './src/components/MessageEnhancements/EngagementScoring'
          ],
          // ... more chunks
        }
      }
    }
  }
});
```

**Performance Targets:**
- Initial bundle: <500KB (down from 1.2MB)
- Messages.tsx: <100KB (down from 332KB)
- Time to Interactive: <3s (down from 5-7s)
- Lazy chunks: <50KB each
- First Contentful Paint: <1.5s

**Files to Modify:**
- [vite.config.ts](f:/pulse1/vite.config.ts) - Manual chunks configuration
- [Messages.tsx](f:/pulse1/src/components/Messages.tsx) - Add lazy loading
- [package.json](f:/pulse1/package.json) - Add bundle analyzer script

**Monitoring Setup:**
- Configure Lighthouse CI in `.github/workflows/lighthouse.yml`
- Add bundle size check to CI pipeline
- Set up performance budgets in `lighthouse-budget.json`

**Success Criteria:**
- Bundle size reduced by 60%+
- Lighthouse performance score >90
- No performance regressions in CI
- All lazy loaded features work correctly

**Handoff To:** DevOps Engineer (CI/CD integration)

---

#### Agent 4: QA Engineer
**Spawn Command:**
```
Use Task tool with subagent_type: "EvidenceQA"
```

**Responsibilities:**
1. Set up test infrastructure (Vitest + Playwright)
2. Create test templates and patterns
3. Write unit tests for MessageInput component
4. Create integration tests for AI features
5. Set up E2E test suite with Playwright
6. Implement visual regression testing
7. Create test documentation

**Test Structure to Create:**
```
src/
├── __tests__/
│   ├── components/
│   │   ├── MessageInput.test.tsx
│   │   ├── AIComposer.test.tsx
│   │   └── ToneAnalyzer.test.tsx
│   ├── hooks/
│   │   └── useMessageEnhancements.test.ts
│   └── integration/
│       └── message-sending.test.tsx
e2e/
├── messaging.spec.ts
├── ai-features.spec.ts
└── fixtures/
    └── mockMessages.json
```

**Test Coverage Targets:**
- Services: 80%
- Components: 70%
- Hooks: 75%
- Integration: Critical paths covered

**Example Unit Test:**
```typescript
// src/__tests__/components/MessageInput.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageInput } from '@/components/MessageInput';

describe('MessageInput', () => {
  it('should show AI suggestions after typing', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<MessageInput onSend={onSend} aiEnabled={true} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'Can we schedule a meeting?');

    await waitFor(() => {
      expect(screen.getByText(/AI suggests/i)).toBeInTheDocument();
    }, { timeout: 1000 });
  });
});
```

**Example E2E Test:**
```typescript
// e2e/ai-features.spec.ts
import { test, expect } from '@playwright/test';

test('smart compose suggestions', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Login
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Navigate to messages
  await page.click('[data-testid="messages-nav"]');
  await page.click('[data-testid="thread-1"]');

  // Type message
  await page.fill('[data-testid="message-input"]', 'Can you send me');

  // Wait for AI suggestions
  await page.waitForSelector('[data-testid="ai-suggestion"]');

  // Verify suggestion appears
  expect(await page.locator('[data-testid="ai-suggestion"]').count()).toBeGreaterThan(0);
});
```

**Success Criteria:**
- All test suites run in CI
- Coverage thresholds enforced
- E2E tests cover critical user journeys
- Visual regression baseline established
- Test execution time <5 minutes

**Handoff From:** Frontend Developer (components to test)
**Handoff To:** DevOps Engineer (CI integration)

---

### Phase 2: AI Backend Completion (Weeks 3-4)

Deploy agents **sequentially** with dependencies:

#### Agent 5: AI/ML Engineer
**Spawn Command:**
```
Use Task tool with subagent_type: "engineering-ai-engineer"
```

**Responsibilities:**
1. Complete all 13 functions in [brainstormService.ts](f:/pulse1/src/services/brainstormService.ts)
2. Implement AI prompts for each function using appropriate models
3. Add caching layer for expensive AI operations
4. Implement error handling with provider fallback
5. Create embedding-based similarity search
6. Wire up Supabase persistence for brainstorm sessions
7. Test AI quality and accuracy

**Implementation Priority:**

**High Priority (Week 3, Days 1-3):**
1. `autoClusterIdeas()` - Gemini 2.5 Flash
   ```typescript
   async autoClusterIdeas(ideas: Idea[], numClusters: number): Promise<ClusterSuggestion[]> {
     const prompt = `Analyze these ${ideas.length} ideas and group them into ${numClusters} thematic clusters.
     For each cluster provide: name (2-4 words), theme description, idea IDs, confidence (0-1).

     Ideas: ${ideas.map((i, idx) => `[${i.id}] ${i.text}`).join('\n')}

     Return JSON: { clusters: [{ name, theme, ideaIds: [], confidence }] }`;

     const response = await processWithModel(apiKey, prompt, 'gemini-2.5-flash');
     const result = JSON.parse(response);

     // Cache result
     await aiCache.set(`cluster-${sessionId}-${hash(ideas)}-${numClusters}`, result);

     return result.clusters;
   }
   ```

2. `expandIdea()` - GPT-4o
   ```typescript
   async expandIdea(idea: Idea, topic: string): Promise<IdeaExpansion> {
     const prompt = `Expand on this brainstorm idea with actionable details:

     Topic: ${topic}
     Idea: ${idea.text}

     Provide:
     1. Detailed description (how it would work) - 2-3 paragraphs
     2. 3-5 key benefits with specific outcomes
     3. 2-3 potential challenges with mitigation strategies
     4. 3-4 concrete next steps to implement (actionable)

     Return JSON: { description, benefits: [], challenges: [], nextSteps: [] }`;

     const response = await processWithModel(apiKey, prompt, 'gpt-4o');
     return JSON.parse(response);
   }
   ```

3. `generateVariations()` - Gemini 2.5 Flash
   ```typescript
   async generateVariations(idea: Idea, topic: string): Promise<IdeaVariation[]> {
     const prompt = `Generate 5 creative variations of this idea:

     Topic: ${topic}
     Original: ${idea.text}

     Create:
     1. SIMPLIFIED: Stripped to bare essentials
     2. AMPLIFIED: Taken to extreme/maximum scale
     3. COMBINED: Merged with complementary concept
     4. OPPOSITE: Reverse/inverse approach
     5. ALTERNATIVE: Different path to same goal

     Return JSON: { variations: [{ type, text, rationale }] }`;

     const response = await processWithModel(apiKey, prompt, 'gemini-2.5-flash');
     return JSON.parse(response).variations;
   }
   ```

**Medium Priority (Week 3, Days 4-5):**
4. `synthesizeIdeas()` - Claude Sonnet 4
5. `findGaps()` - Claude Sonnet 4
6. `scoreSynthesis()` - Multi-factor AI

**Lower Priority (Week 4, Days 1-2):**
7. `checkSimilarity()` - OpenAI embeddings
8. `findConnections()` - Embeddings + AI
9. `scamperGenerate()` - Gemini 2.5 Flash
10. `sixHatsGenerate()` - GPT-4o

**Export Functions (Week 4, Day 3):**
11. `exportToMindmap()` - FreeMind XML/Mermaid
12. `exportToPresentation()` - HTML/Markdown

**Persistence (Week 4, Day 3):**
13. Session save/load - Supabase integration

**Database Schema to Create:**
```sql
-- Create migration: f:/pulse1/supabase/migrations/031_brainstorm_sessions.sql
CREATE TABLE IF NOT EXISTS brainstorm_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  framework TEXT, -- 'scamper', 'six_hats', 'free_form'
  ideas JSONB DEFAULT '[]'::JSONB,
  clusters JSONB DEFAULT '[]'::JSONB,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collaborators UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_brainstorm_sessions_owner ON brainstorm_sessions(owner_id);
CREATE INDEX idx_brainstorm_sessions_updated ON brainstorm_sessions(updated_at DESC);

CREATE TABLE IF NOT EXISTS brainstorm_ai_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  operation_type TEXT,
  input_hash TEXT,
  result JSONB,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_brainstorm_ai_cache_lookup ON brainstorm_ai_cache(session_id, operation_type, input_hash);

-- RLS Policies
ALTER TABLE brainstorm_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON brainstorm_sessions FOR SELECT
  USING (auth.uid() = owner_id OR auth.uid() = ANY(collaborators));

CREATE POLICY "Users can create sessions"
  ON brainstorm_sessions FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their sessions"
  ON brainstorm_sessions FOR UPDATE
  USING (auth.uid() = owner_id OR auth.uid() = ANY(collaborators));
```

**Error Handling Pattern:**
```typescript
async function withAIRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (attempt === maxRetries - 1) throw error;

      // Exponential backoff
      await new Promise(resolve =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt))
      );
    }
  }
  throw new Error('All retries exhausted');
}
```

**Testing Requirements:**
- Unit tests with mocked AI responses
- Integration tests with real API (nightly)
- Prompt snapshot tests
- Quality evaluation (human review sample)

**Success Criteria:**
- All 13 functions implemented and tested
- AI responses have >70% user acceptance
- Caching reduces API calls by 50%+
- Error handling works correctly
- Supabase persistence functional

**Handoff To:** Backend Architect (service integration)

---

#### Agent 6: Backend Architect
**Spawn Command:**
```
Use Task tool with subagent_type: "Backend Architect"
```

**Responsibilities:**
1. Create auto-response service
2. Create message summarization service
3. Create conversation intelligence service
4. Integrate AI services with message flow
5. Design database schema for new features
6. Create Supabase RPC functions
7. Implement rate limiting and cost tracking

**Services to Create:**

**1. Auto-Response Service**
File: [messageAutoResponseService.ts](f:/pulse1/src/services/messageAutoResponseService.ts)

```typescript
interface AutoResponseRule {
  id: string;
  userId: string;
  ruleType: 'smart_reply' | 'rule_based' | 'out_of_office' | 'template';
  enabled: boolean;
  triggerConditions: {
    keywords?: string[];
    senders?: string[];
    channels?: string[];
    timeRange?: { start: string; end: string };
  };
  responseTemplate: string;
  aiCustomize: boolean;
  priority: number;
}

class MessageAutoResponseService {
  async checkAutoResponse(
    message: ChannelMessage,
    channelId: string,
    userId: string
  ): Promise<string | null> {
    // Get enabled rules
    const { data: rules } = await supabase
      .from('message_auto_responses')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true)
      .order('priority', { ascending: false });

    if (!rules) return null;

    // Check each rule
    for (const rule of rules) {
      if (await this.matchesRule(message, channelId, rule)) {
        return await this.generateResponse(message, rule);
      }
    }

    return null;
  }

  private async matchesRule(
    message: ChannelMessage,
    channelId: string,
    rule: AutoResponseRule
  ): Promise<boolean> {
    const conditions = rule.triggerConditions;

    // Check keywords
    if (conditions.keywords && conditions.keywords.length > 0) {
      const content = message.content.toLowerCase();
      const hasKeyword = conditions.keywords.some(kw =>
        content.includes(kw.toLowerCase())
      );
      if (!hasKeyword) return false;
    }

    // Check senders
    if (conditions.senders && !conditions.senders.includes(message.sender_id)) {
      return false;
    }

    // Check channels
    if (conditions.channels && !conditions.channels.includes(channelId)) {
      return false;
    }

    return true;
  }

  private async generateResponse(
    message: ChannelMessage,
    rule: AutoResponseRule
  ): Promise<string> {
    let response = rule.responseTemplate;

    // AI customization
    if (rule.aiCustomize) {
      const apiKey = await this.getApiKey();
      if (apiKey) {
        const customized = await this.customizeWithAI(message, response, apiKey);
        response = customized || response;
      }
    }

    // Variable substitution
    response = response.replace(/{sender_name}/g, message.sender_name || 'there');
    response = response.replace(/{date}/g, new Date().toLocaleDateString());
    response = response.replace(/{time}/g, new Date().toLocaleTimeString());

    // Log trigger
    await this.logResponse(rule.id, message, response);

    return response;
  }

  private async customizeWithAI(
    message: ChannelMessage,
    template: string,
    apiKey: string
  ): Promise<string | null> {
    const prompt = `Customize this auto-response based on the incoming message:

    Message: "${message.content}"
    Template: "${template}"

    Make it feel personal and contextual, not automated. Keep it concise (1-2 sentences).
    Return only the customized response.`;

    try {
      return await processWithModel(apiKey, prompt, 'gemini-2.5-flash-lite');
    } catch (error) {
      console.error('AI customization failed:', error);
      return null;
    }
  }
}

export const messageAutoResponseService = new MessageAutoResponseService();
```

**2. Message Summarization Service**
File: [messageSummarizationService.ts](f:/pulse1/src/services/messageSummarizationService.ts)

```typescript
interface ThreadSummary {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
  participants: string[];
  messageCount: number;
}

class MessageSummarizationService {
  async summarizeThread(
    channelId: string,
    threadId: string,
    apiKey: string
  ): Promise<ThreadSummary> {
    // Check cache
    const cached = await this.getCachedSummary('thread', threadId);
    if (cached) return cached;

    // Get messages
    const messages = await messageChannelService.getThreadMessages(threadId);
    if (messages.length === 0) {
      throw new Error('No messages in thread');
    }

    // Build context
    const context = messages.map(m =>
      `[${m.sender_name}]: ${m.content}`
    ).join('\n');

    // Generate summary
    const prompt = `Summarize this conversation thread:

${context}

Provide:
1. Overall summary (2-3 sentences)
2. Key points discussed (3-5 bullet points)
3. Action items identified
4. Decisions made
5. Participants involved

Return JSON: {
  summary: string,
  keyPoints: string[],
  actionItems: string[],
  decisions: string[],
  participants: string[]
}`;

    const response = await processWithModel(apiKey, prompt, 'gemini-2.5-flash');
    const result = JSON.parse(response);

    // Cache
    await this.cacheSummary('thread', threadId, result, messages.length);

    return {
      ...result,
      messageCount: messages.length
    };
  }

  async generateDailyDigest(
    userId: string,
    date: Date,
    apiKey: string
  ): Promise<DailyDigest> {
    // Get all channels for user
    const { data: channels } = await supabase
      .from('message_channels')
      .select('*')
      .eq('workspace_id', userId);

    const channelSummaries = [];
    const allActionItems: string[] = [];

    // Summarize each channel
    for (const channel of channels || []) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('channel_id', channel.id)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());

      if (!messages || messages.length === 0) continue;

      // Summarize channel
      const channelContext = messages.map(m => m.content).join('\n');
      const prompt = `Summarize today's activity in #${channel.name}:

${channelContext}

Provide:
1. Top 3 highlights (brief, 1 line each)
2. Action items mentioned

Return JSON: { highlights: string[], actionItems: string[] }`;

      const response = await processWithModel(apiKey, prompt, 'gemini-2.5-flash-lite');
      const data = JSON.parse(response);

      channelSummaries.push({
        channelId: channel.id,
        channelName: channel.name,
        messageCount: messages.length,
        highlights: data.highlights || []
      });

      allActionItems.push(...(data.actionItems || []));
    }

    // Overall summary
    const overallPrompt = `Create a brief daily summary from these highlights:

${channelSummaries.map(c => `#${c.channelName}: ${c.highlights.join('; ')}`).join('\n')}

Provide a 2-3 sentence overview.`;

    const overallSummary = await processWithModel(apiKey, overallPrompt, 'gemini-2.5-flash-lite');

    return {
      summary: overallSummary,
      channelSummaries,
      actionItems: [...new Set(allActionItems)],
      totalMessages: channelSummaries.reduce((sum, c) => sum + c.messageCount, 0)
    };
  }
}

export const messageSummarizationService = new MessageSummarizationService();
```

**Database Migrations:**
```sql
-- f:/pulse1/supabase/migrations/032_auto_response_rules.sql
CREATE TABLE message_auto_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  trigger_conditions JSONB NOT NULL,
  response_template TEXT NOT NULL,
  ai_customize BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  times_triggered INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- f:/pulse1/supabase/migrations/033_conversation_summaries.sql
CREATE TABLE conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  summary_text TEXT NOT NULL,
  key_points TEXT[],
  action_items TEXT[],
  decisions TEXT[],
  participants TEXT[],
  message_count INTEGER,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);
```

**Success Criteria:**
- All services implemented and tested
- Database migrations applied successfully
- RLS policies secure data access
- Services integrate with message flow
- Rate limiting prevents abuse

**Handoff From:** AI/ML Engineer (AI service patterns)
**Handoff To:** Frontend Developer (UI integration)

---

#### Agent 7: Integration Specialist
**Spawn Command:**
```
Use Task tool with subagent_type: "Backend Architect"
```

**Responsibilities:**
1. Complete CRM integrations (HubSpot, Salesforce, Pipedrive, Zoho)
2. Implement OAuth flows for each provider
3. Create bi-directional sync logic
4. Handle rate limiting and error recovery
5. Test all CRM operations
6. Document setup procedures

**CRM Providers:**

**HubSpot Integration:**
```typescript
// f:/pulse1/src/services/crm/hubspotService.ts
class HubSpotService {
  async createTask(integration: CRMIntegration, payload: CRMActionPayload) {
    const endpoint = 'https://api.hubapi.com/crm/v3/objects/tasks';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          hs_task_subject: payload.fields.title,
          hs_task_body: payload.fields.description,
          hs_task_priority: payload.fields.priority || 'MEDIUM',
          hs_timestamp: payload.fields.dueDate || Date.now()
        },
        associations: payload.associatedRecordId ? [{
          to: { id: payload.associatedRecordId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 204 }]
        }] : []
      })
    });

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.statusText}`);
    }

    return await response.json();
  }

  async updateDeal(integration: CRMIntegration, dealId: string, payload: CRMActionPayload) {
    const endpoint = `https://api.hubapi.com/crm/v3/objects/deals/${dealId}`;
    const properties: any = {};

    if (payload.fields.stage) properties.dealstage = payload.fields.stage;
    if (payload.fields.amount) properties.amount = payload.fields.amount;
    if (payload.fields.closeDate) properties.closedate = payload.fields.closeDate;

    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties })
    });

    if (!response.ok) throw new Error(`HubSpot API error: ${response.statusText}`);
    return await response.json();
  }
}
```

**Salesforce Integration:**
```typescript
// f:/pulse1/src/services/crm/salesforceService.ts
class SalesforceService {
  async createTask(integration: CRMIntegration, payload: CRMActionPayload) {
    const endpoint = `${integration.instance_url}/services/data/v58.0/sobjects/Task`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        Subject: payload.fields.title,
        Description: payload.fields.description,
        Priority: payload.fields.priority || 'Normal',
        Status: 'Not Started',
        ActivityDate: payload.fields.dueDate,
        WhoId: payload.associatedRecordId
      })
    });

    if (!response.ok) throw new Error(`Salesforce API error: ${response.statusText}`);
    return await response.json();
  }
}
```

**Common Error Handling:**
```typescript
async function withCRMRetry<T>(
  operation: () => Promise<T>,
  integration: CRMIntegration
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Handle token expiration
    if (error.message.includes('401') || error.message.includes('expired')) {
      await refreshCRMToken(integration);
      return await operation();
    }

    // Handle rate limiting
    if (error.message.includes('429')) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      return await operation();
    }

    throw error;
  }
}
```

**Testing Requirements:**
- Sandbox accounts for each CRM
- OAuth flow testing
- CRUD operation testing
- Rate limit handling
- Error recovery testing

**Success Criteria:**
- All 4 CRM providers functional
- OAuth flows work correctly
- Sync operations complete successfully
- Rate limiting handled gracefully
- Comprehensive error messages

**Handoff To:** QA Engineer (integration testing)

---

### Phase 3: Analytics & Intelligence (Week 5)

Deploy agents **in parallel**:

#### Agent 8: Data Engineer
**Spawn Command:**
```
Use Task tool with subagent_type: "Analytics Reporter"
```

**Responsibilities:**
1. Create message analytics service
2. Implement analytics calculations (volume, response time, engagement)
3. Design database schema for analytics storage
4. Create materialized views for performance
5. Implement analytics caching
6. Build analytics dashboard component

**Files to Create:**
- [messageAnalyticsService.ts](f:/pulse1/src/services/messageAnalyticsService.ts)
- [MessageAnalyticsDashboard.tsx](f:/pulse1/src/components/Messages/MessageAnalyticsDashboard.tsx)

**Analytics Metrics:**
```typescript
interface MessageAnalytics {
  timeline: {
    labels: string[];
    sentCounts: number[];
    receivedCounts: number[];
  };
  responseTime: {
    average: number;
    median: number;
    trend: 'improving' | 'stable' | 'worsening';
    distribution: Array<{ range: string; count: number }>;
  };
  engagement: {
    score: number; // 0-100
    mostActiveHours: number[];
    mostActiveDays: string[];
    hourlyDistribution: Record<number, number>;
  };
  patterns: {
    totalMessages: number;
    avgMessageLength: number;
    questionRate: number;
    emojiUsage: number;
    peakActivity: { hour: number; day: string };
  };
}
```

**Database Schema:**
```sql
-- f:/pulse1/supabase/migrations/034_message_analytics.sql
CREATE TABLE message_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  daily_counts JSONB DEFAULT '{}',
  hourly_distribution JSONB DEFAULT '{}',
  avg_response_time_minutes NUMERIC(8,2),
  median_response_time_minutes NUMERIC(8,2),
  response_time_trend TEXT,
  most_active_hours INTEGER[],
  most_active_days TEXT[],
  engagement_score INTEGER DEFAULT 50,
  total_messages INTEGER DEFAULT 0,
  avg_message_length INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Success Criteria:**
- Analytics calculate accurately
- Dashboard loads in <1s
- Real-time updates work
- Mobile responsive

**Handoff To:** Frontend Developer (dashboard UI)

---

#### Agent 9: Conversation Intelligence Specialist
**Spawn Command:**
```
Use Task tool with subagent_type: "engineering-ai-engineer"
```

**Responsibilities:**
1. Create conversation intelligence service
2. Implement sentiment analysis
3. Implement topic detection
4. Create engagement scoring algorithm
5. Build follow-up suggestion engine
6. Create insights sidebar component

**Service Implementation:**
File: [conversationIntelligenceService.ts](f:/pulse1/src/services/conversationIntelligenceService.ts)

```typescript
class ConversationIntelligenceService {
  async analyzeConversation(
    channelId: string,
    messages: ChannelMessage[],
    apiKey: string
  ): Promise<ConversationIntelligence> {
    const recentMessages = messages.slice(-50);

    // Parallel analysis
    const [sentiment, topics, followUps] = await Promise.all([
      this.analyzeSentiment(recentMessages, apiKey),
      this.detectTopics(recentMessages, apiKey),
      this.generateFollowUpSuggestions(recentMessages, apiKey)
    ]);

    const engagement = this.calculateEngagement(messages);

    return { sentiment, topics, engagement, followUpSuggestions: followUps };
  }

  private async analyzeSentiment(messages: ChannelMessage[], apiKey: string) {
    const context = messages.map(m => m.content).join('\n');
    const prompt = `Analyze sentiment:

${context}

Return JSON: {
  current: "positive" | "neutral" | "negative" | "mixed",
  score: -1 to 1,
  reason: string,
  trend: "improving" | "declining" | "stable"
}`;

    const response = await processWithModel(apiKey, prompt, 'gemini-2.5-flash');
    return JSON.parse(response);
  }
}
```

**Success Criteria:**
- Sentiment detection >80% accurate
- Topics relevant to conversation
- Follow-up suggestions actionable
- Insights update in real-time

**Handoff To:** Frontend Developer (UI integration)

---

### Phase 4: Polish & Deployment (Week 6)

#### Agent 10: DevOps Engineer
**Spawn Command:**
```
Use Task tool with subagent_type: "DevOps Automator"
```

**Responsibilities:**
1. Set up CI/CD pipeline
2. Configure deployment automation
3. Set up monitoring and alerting
4. Implement feature flags
5. Create rollback procedures
6. Configure production environment

**CI/CD Pipeline:**
File: [.github/workflows/deploy.yml](f:/pulse1/.github/workflows/deploy.yml)

```yaml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test
      - run: npm run test:e2e

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v3
      - run: npx vercel deploy --prebuilt
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}

  deploy-production:
    needs: deploy-staging
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v3
      - run: npx vercel deploy --prod --prebuilt
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

**Success Criteria:**
- CI/CD pipeline functional
- Automated testing in CI
- Deployment automation works
- Monitoring captures errors
- Feature flags functional

---

## Handoff Protocols

### Information Flow

```
UI Designer → Frontend Developer: Wireframes, design specs, CSS tokens
Frontend Developer → QA Engineer: Components for testing
QA Engineer → DevOps: Test suites for CI
Performance Engineer → DevOps: Performance budgets
AI/ML Engineer → Backend Architect: AI service patterns, API contracts
Backend Architect → Frontend Developer: Service APIs, TypeScript types
Integration Specialist → QA Engineer: CRM test credentials
Data Engineer → Frontend Developer: Analytics data format
All → Technical Writer: Implementation details for docs
```

### Communication Channels

**For Blockers:**
- Create GitHub issue with label `blocker`
- Tag relevant agent in issue
- Escalate if not resolved in 24 hours

**For Questions:**
- Use GitHub Discussions for technical questions
- Tag relevant agent
- Document answers in wiki

**For Updates:**
- Daily progress updates in Slack/Discord
- Weekly demo sessions
- Bi-weekly retrospectives

---

## Success Metrics by Agent

### Frontend Developer
- [ ] MessageInput component <30KB
- [ ] Component renders in <100ms
- [ ] Zero prop drilling
- [ ] >70% test coverage

### Performance Engineer
- [ ] Bundle reduced by 60%
- [ ] TTI <3s
- [ ] Lighthouse score >90
- [ ] No CI performance regressions

### AI/ML Engineer
- [ ] All 13 functions implemented
- [ ] AI accuracy >70%
- [ ] Response time <2s (p95)
- [ ] Cost <$0.01 per request

### Backend Architect
- [ ] All services functional
- [ ] Database migrations successful
- [ ] RLS policies secure
- [ ] Rate limiting prevents abuse

### Integration Specialist
- [ ] All 4 CRMs working
- [ ] OAuth flows functional
- [ ] Sync success rate >95%
- [ ] Error recovery works

### QA Engineer
- [ ] Test coverage >80%
- [ ] E2E tests pass
- [ ] No critical bugs
- [ ] Performance tests pass

### DevOps Engineer
- [ ] CI/CD pipeline functional
- [ ] Zero-downtime deployment
- [ ] Monitoring captures errors
- [ ] Rollback <5 minutes

---

## Emergency Contacts

**Project Lead:** [Your Name]
**Technical Lead:** [Technical Lead]
**On-Call Rotation:** [Link to PagerDuty/schedule]

**Escalation Path:**
1. Agent → Team Lead (response: 2 hours)
2. Team Lead → Technical Lead (response: 4 hours)
3. Technical Lead → Project Lead (response: 8 hours)

---

## Resources

**Documentation:**
- Main Plan: [C:\Users\Aegis{FM}\.claude\plans\synchronous-rolling-cloud.md](C:\Users\Aegis{FM}\.claude\plans\synchronous-rolling-cloud.md)
- Architecture Diagram: [To be created]
- API Documentation: [To be created]

**Development:**
- GitHub Repo: [f:/pulse1](f:/pulse1)
- Staging Environment: [TBD]
- Production Environment: [TBD]

**Tools:**
- Supabase Dashboard: https://app.supabase.com
- Vercel Dashboard: https://vercel.com
- CI/CD: GitHub Actions

---

## Getting Started

1. **Read the main plan:** [synchronous-rolling-cloud.md](C:\Users\Aegis{FM}\.claude\plans\synchronous-rolling-cloud.md)
2. **Identify your role:** Find your agent section above
3. **Check dependencies:** Ensure prerequisite agents have completed
4. **Set up environment:** Install dependencies, configure API keys
5. **Create feature branch:** `git checkout -b feature/[your-feature]`
6. **Start implementation:** Follow your agent's responsibilities
7. **Write tests:** As you build features
8. **Document changes:** Update relevant docs
9. **Submit PR:** When ready for review
10. **Hand off:** Notify next agent in chain

**Let's build something amazing! 🚀**
