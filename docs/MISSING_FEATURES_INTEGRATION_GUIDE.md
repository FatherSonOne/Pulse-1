# Missing Features Integration Guide for Pulse1

**Generated**: January 19, 2026
**Purpose**: Catalog features from original Pulse repository with integration instructions
**Source**: Analysis of `/f/pulse` stash and directory structure

---

## Table of Contents

1. [Browser Extension](#1-browser-extension-high-priority)
2. [Enhanced Message Input](#2-enhanced-message-input-medium-priority)
3. [Tools Panel System](#3-tools-panel-system-medium-priority)
4. [Email Template System](#4-email-template-system-high-priority)
5. [Message Enhancement Bundles](#5-message-enhancement-bundles-low-priority)
6. [CRM Integration Enhancements](#6-crm-integration-enhancements-medium-priority)
7. [Dashboard Widget System](#7-dashboard-widget-system-medium-priority)
8. [Additional Voxer Modes](#8-additional-voxer-modes-low-priority)

---

## Priority Legend

- 🔴 **HIGH PRIORITY**: Significant user value, immediate impact
- 🟡 **MEDIUM PRIORITY**: Nice-to-have, improves UX
- 🟢 **LOW PRIORITY**: Polish, optimization, or redundant features

---

## 1. Browser Extension (🔴 HIGH PRIORITY)

### Overview
Complete Chrome/Firefox extension for capturing web content directly to Pulse War Room. Allows users to save articles, research, and notes from any webpage without leaving their browser.

### Current Status
**❌ NOT PRESENT in Pulse1**

### Files to Port
```
Source: /f/pulse/browser-extension/
Destination: /f/pulse1/browser-extension/

Files (21 total):
├── manifest.json                    # Extension manifest (Manifest v3)
├── popup.html                       # Popup UI template
├── options.html                     # Settings page template
├── src/
│   ├── background.js               # Service worker (10,791 lines)
│   ├── content.js                  # Content script (10,790 lines)
│   ├── popup.js                    # Popup logic (9,057 lines)
│   └── options.js                  # Options page logic (3,981 lines)
├── styles/
│   ├── popup.css                   # Popup styling
│   ├── options.css                 # Options styling
│   └── content.css                 # Content script styling
├── icons/
│   ├── icon-16.png                 # 16x16 icon
│   ├── icon-32.png                 # 32x32 icon
│   ├── icon-48.png                 # 48x48 icon
│   ├── icon-128.png                # 128x128 icon
│   └── icon.svg                    # Vector icon
└── README.md                        # Extension documentation
```

### Key Features
1. **Quick Capture Popup** (Ctrl+Shift+P)
   - Popup overlay for quick saves
   - Project selection dropdown
   - Title/notes input
   - Save/cancel buttons

2. **Selection Capture** (Ctrl+Shift+S)
   - Capture highlighted text
   - Preserves formatting
   - Includes source URL

3. **Full Page Capture** (Ctrl+Shift+A)
   - Captures entire article
   - Extracts metadata (title, author, date)
   - Cleans up HTML

4. **Context Menu Integration**
   - Right-click → "Save to Pulse"
   - Options for: selection, page, link, image

5. **Authentication Flow**
   - OAuth 2.0 with Google
   - Token management
   - Session persistence

### Integration Points

#### A. Supabase API Endpoints
Extension calls these REST endpoints:
```javascript
POST   https://pulse.logosvision.org/rest/v1/knowledge_docs
POST   https://pulse.logosvision.org/rest/v1/project_docs
GET    https://pulse.logosvision.org/rest/v1/projects?user_id=eq.{userId}
```

#### B. Authentication Callback Routes
Add these routes to your web app:
```typescript
// In src/App.tsx or routing config
<Route path="/auth/extension-login" element={<ExtensionLogin />} />
<Route path="/auth/extension-callback" element={<ExtensionCallback />} />
```

#### C. Database Tables Required
```sql
-- knowledge_docs table
CREATE TABLE knowledge_docs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  content TEXT,
  url TEXT,
  source_type TEXT, -- 'web_capture', 'manual', etc.
  metadata JSONB, -- author, date, excerpt, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- project_docs table (links docs to projects)
CREATE TABLE project_docs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  doc_id UUID REFERENCES knowledge_docs(id),
  added_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_knowledge_docs_user ON knowledge_docs(user_id);
CREATE INDEX idx_knowledge_docs_url ON knowledge_docs(url);
CREATE INDEX idx_project_docs_project ON project_docs(project_id);
CREATE INDEX idx_project_docs_doc ON project_docs(doc_id);
```

### Agent Integration Instructions

#### Step 1: Copy Extension Directory
```bash
cp -r ../pulse/browser-extension ./
```

#### Step 2: Update Configuration
Edit `browser-extension/manifest.json`:
```json
{
  "homepage_url": "https://YOUR_DOMAIN",
  "host_permissions": [
    "https://YOUR_DOMAIN/*",
    "https://YOUR_SUPABASE_PROJECT.supabase.co/*"
  ]
}
```

#### Step 3: Update API URLs
Edit `browser-extension/src/background.js`:
```javascript
// Line ~25: Update API base URL
const API_BASE = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const APP_BASE = 'https://YOUR_DOMAIN';
```

#### Step 4: Create Migration
```bash
# Create migration file
npx supabase migration new browser_extension_support

# Add tables from SQL above
# Then run:
npx supabase db push
```

#### Step 5: Add Auth Callback Routes
Create `src/components/Auth/ExtensionLogin.tsx`:
```typescript
import { useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function ExtensionLogin() {
  useEffect(() => {
    // Handle extension OAuth flow
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/extension-callback`
      }
    });
  }, []);

  return <div>Redirecting to login...</div>;
}
```

Create `src/components/Auth/ExtensionCallback.tsx`:
```typescript
import { useEffect } from 'react';

export default function ExtensionCallback() {
  useEffect(() => {
    // Extract auth token from URL
    const hashParams = new URLSearchParams(
      window.location.hash.substring(1)
    );
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    if (accessToken) {
      // Send tokens back to extension
      window.opener?.postMessage({
        type: 'PULSE_AUTH_SUCCESS',
        accessToken,
        refreshToken
      }, '*');
      window.close();
    }
  }, []);

  return <div>Authentication successful! You can close this window.</div>;
}
```

#### Step 6: Build Extension
```bash
cd browser-extension
npm install  # if package.json exists
# or just use the files as-is (vanilla JS)

# For Chrome: Load unpacked extension
# 1. Go to chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select browser-extension/ folder

# For Firefox:
# 1. Go to about:debugging#/runtime/this-firefox
# 2. Click "Load Temporary Add-on"
# 3. Select manifest.json
```

### Testing Checklist
- [ ] Extension loads without errors
- [ ] Login flow completes successfully
- [ ] Can capture selected text
- [ ] Can capture full page
- [ ] Content appears in War Room
- [ ] Context menu items work
- [ ] Keyboard shortcuts function
- [ ] Settings persist across sessions

### Dependencies
- Google OAuth configured in Supabase
- `projects` table exists with user access
- RLS policies allow extension writes

---

## 2. Enhanced Message Input (🟡 MEDIUM PRIORITY)

### Overview
Advanced message composition interface with AI-powered features, tone analysis, rich text formatting, and attachment management.

### Current Status
**⚠️ PARTIALLY PRESENT** - Basic components exist in Pulse1 but enhanced features missing

### Files to Port
```
Source: /f/pulse/src/components/MessageInput/
Destination: Already exists in Pulse1 (enhanced version)

Pulse1 has NEWER implementation with:
├── MessageInput.tsx           # Main component (11KB)
├── AIComposer.tsx            # AI suggestions
├── FormattingToolbar.tsx     # Rich text toolbar
├── ToneAnalyzer.tsx          # Sentiment analysis
├── AttachmentPreview.tsx     # Attachment handling
├── types.ts                  # TypeScript definitions
├── index.ts                  # Barrel export
├── README.md                 # Documentation
└── MessageInput.css          # Styling
```

### Key Features (Already in Pulse1)
1. **AI Composer**
   - Real-time AI suggestions
   - Context-aware completions
   - Tone recommendations

2. **Formatting Toolbar**
   - Bold, italic, underline
   - Lists (ordered/unordered)
   - Code blocks
   - Links
   - Markdown support

3. **Tone Analyzer**
   - Sentiment detection (positive/negative/neutral)
   - Formality score
   - Clarity metrics
   - Suggestions for improvement

4. **Attachment Preview**
   - File upload handling
   - Image/document previews
   - Drag-and-drop support
   - Size validation

### Integration Status
✅ **ALREADY INTEGRATED in Pulse1** - No action needed

### Comparison with Original Pulse
The Pulse1 version is MORE ADVANCED than original Pulse. Consider this feature complete.

---

## 3. Tools Panel System (🟡 MEDIUM PRIORITY)

### Overview
Contextual tool suggestion system that surfaces relevant features based on user activity and context. Improves feature discoverability.

### Current Status
**✅ PRESENT in Pulse1** - Complete implementation

### Files Location
```
Location: /f/pulse1/src/components/ToolsPanel/

Files (12):
├── ToolsPanel.tsx                 # Main component (10KB)
├── toolsData.ts                   # Tool definitions (12KB)
├── CategoryTabs.tsx               # Category filtering
├── ContextualSuggestions.tsx      # Smart suggestions (9KB)
├── SearchBox.tsx                  # Search functionality
├── QuickAccessBar.tsx             # Quick access (6KB)
├── ToolCard.tsx                   # Tool display card
├── useToolsStorage.ts             # Local storage hook
├── types.ts                       # TypeScript types
├── index.ts                       # Barrel export
├── README.md                      # Documentation
└── example.tsx                    # Usage example
```

### Key Features
1. **Categorized Tools**
   - AI & Intelligence
   - Communication
   - Productivity
   - Analytics
   - Automation
   - Security
   - Collaboration

2. **Contextual Suggestions**
   - Analyzes current message content
   - Suggests relevant tools
   - Learns from usage patterns

3. **Search & Filter**
   - Full-text search across tools
   - Category filtering
   - Tag-based organization

4. **Quick Access Bar**
   - Pinned favorite tools
   - Recent tools
   - Most used tools

5. **Usage Tracking**
   - Local storage persistence
   - Tool usage analytics
   - Preference learning

### Integration Status
✅ **ALREADY INTEGRATED in Pulse1** - No action needed

This is a NEW feature in Pulse1 that doesn't exist in original Pulse.

---

## 4. Email Template System (🔴 HIGH PRIORITY)

### Overview
Comprehensive email template system with variables, categories, AI generation, and template sharing. Dramatically improves email productivity.

### Current Status
**❌ PARTIALLY MISSING** - Email components exist but template system incomplete

### Files to Port
```
Source: /f/pulse/src/components/Email/
Destination: /f/pulse1/src/components/Email/

Files to add/enhance:
├── EmailTemplatesModal.tsx       # Template browser (existing)
├── EmailTemplatesModal.css       # Template styling (existing)
├── TemplateEditor.tsx            # Template editing UI (MISSING)
├── TemplateVariablesModal.tsx    # Variable insertion (MISSING)
```

### Key Features

#### A. Template Management
1. **Template Browser**
   - Search templates by name/content
   - Category filtering (Sales, Support, Marketing, etc.)
   - Favorite templates
   - Recent templates

2. **Template Editor**
   - Rich text editing
   - Variable insertion (e.g., {{firstName}}, {{company}})
   - Preview mode
   - Test variable replacement

3. **Template Categories**
   - Sales Outreach
   - Customer Support
   - Marketing Campaigns
   - Internal Communication
   - Follow-ups
   - Custom categories

#### B. Template Variables
Common variables supported:
```javascript
{
  // Contact variables
  {{firstName}}, {{lastName}}, {{fullName}},
  {{email}}, {{company}}, {{title}},

  // Message context
  {{subject}}, {{previousSubject}},
  {{threadContext}}, {{lastMessage}},

  // User variables
  {{senderName}}, {{senderEmail}},
  {{senderTitle}}, {{senderCompany}},

  // Dynamic
  {{currentDate}}, {{currentTime}},
  {{customField1}}, {{customField2}}
}
```

#### C. AI Template Generation
- Generate templates from brief description
- Suggest improvements to existing templates
- Adapt template tone/formality
- Generate subject line suggestions

### Database Schema
```sql
-- email_templates table
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  category TEXT, -- 'sales', 'support', 'marketing', etc.
  variables JSONB, -- Array of variable names used
  is_favorite BOOLEAN DEFAULT false,
  is_shared BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- template_categories table
CREATE TABLE template_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  color TEXT, -- Hex color for UI
  icon TEXT, -- Icon name/emoji
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_email_templates_user ON email_templates(user_id);
CREATE INDEX idx_email_templates_category ON email_templates(category);
CREATE INDEX idx_email_templates_favorite ON email_templates(is_favorite) WHERE is_favorite = true;
CREATE INDEX idx_template_categories_user ON template_categories(user_id);
```

### Service Layer
Create `src/services/emailTemplateService.ts`:
```typescript
import { supabase } from '../supabaseClient';

export const emailTemplateService = {
  // List templates
  async getTemplates(userId: string, category?: string) {
    let query = supabase
      .from('email_templates')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    return query;
  },

  // Get single template
  async getTemplate(id: string) {
    return supabase
      .from('email_templates')
      .select('*')
      .eq('id', id)
      .single();
  },

  // Create template
  async createTemplate(template: {
    user_id: string;
    name: string;
    subject?: string;
    body: string;
    category?: string;
    variables?: string[];
  }) {
    return supabase
      .from('email_templates')
      .insert(template)
      .select()
      .single();
  },

  // Update template
  async updateTemplate(id: string, updates: Partial<EmailTemplate>) {
    return supabase
      .from('email_templates')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
  },

  // Delete template
  async deleteTemplate(id: string) {
    return supabase
      .from('email_templates')
      .delete()
      .eq('id', id);
  },

  // Toggle favorite
  async toggleFavorite(id: string, isFavorite: boolean) {
    return this.updateTemplate(id, { is_favorite: isFavorite });
  },

  // Increment usage
  async incrementUsage(id: string) {
    const { data } = await this.getTemplate(id);
    if (data) {
      return this.updateTemplate(id, {
        usage_count: (data.usage_count || 0) + 1
      });
    }
  },

  // Extract variables from template body
  extractVariables(body: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = body.matchAll(regex);
    return Array.from(matches, m => m[1].trim());
  },

  // Replace variables with values
  replaceVariables(
    template: string,
    values: Record<string, string>
  ): string {
    let result = template;
    Object.entries(values).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(regex, value);
    });
    return result;
  },

  // Get template categories
  async getCategories(userId: string) {
    return supabase
      .from('template_categories')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order');
  },

  // AI: Generate template from description
  async generateTemplate(description: string, tone?: string) {
    // Call your AI service (Gemini, GPT, Claude)
    // Implementation depends on your AI setup
    return {
      subject: '...',
      body: '...',
      variables: []
    };
  }
};
```

### Integration Instructions

#### Step 1: Create Migration
```bash
npx supabase migration new email_templates
```

Add the SQL schema from above, then:
```bash
npx supabase db push
```

#### Step 2: Copy Missing Components
```bash
# If TemplateEditor.tsx exists in original Pulse:
cp ../pulse/src/components/Email/TemplateEditor.tsx \
   src/components/Email/

cp ../pulse/src/components/Email/TemplateVariablesModal.tsx \
   src/components/Email/
```

#### Step 3: Create Service
```bash
# Create the service file
touch src/services/emailTemplateService.ts
# Copy implementation from above
```

#### Step 4: Integrate into Email Composer
Update `src/components/Email/EmailComposer.tsx`:
```typescript
import { emailTemplateService } from '../../services/emailTemplateService';
import EmailTemplatesModal from './EmailTemplatesModal';

// Add state
const [showTemplates, setShowTemplates] = useState(false);

// Add button to toolbar
<button onClick={() => setShowTemplates(true)}>
  Templates
</button>

// Add modal
{showTemplates && (
  <EmailTemplatesModal
    onClose={() => setShowTemplates(false)}
    onSelectTemplate={async (template) => {
      // Replace variables
      const values = {
        firstName: contact?.first_name || '',
        lastName: contact?.last_name || '',
        company: contact?.company || '',
        // ... other values
      };

      const filledBody = emailTemplateService.replaceVariables(
        template.body,
        values
      );

      setSubject(template.subject || '');
      setBody(filledBody);

      // Track usage
      await emailTemplateService.incrementUsage(template.id);

      setShowTemplates(false);
    }}
  />
)}
```

#### Step 5: Add RLS Policies
```sql
-- Enable RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_categories ENABLE ROW LEVEL SECURITY;

-- Policies for email_templates
CREATE POLICY "Users can view own templates"
  ON email_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates"
  ON email_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
  ON email_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
  ON email_templates FOR DELETE
  USING (auth.uid() = user_id);

-- Similar policies for template_categories
CREATE POLICY "Users can view own categories"
  ON template_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
  ON template_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON template_categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON template_categories FOR DELETE
  USING (auth.uid() = user_id);
```

### Testing Checklist
- [ ] Can create new template
- [ ] Can edit existing template
- [ ] Can delete template
- [ ] Variables are extracted correctly
- [ ] Variable replacement works
- [ ] Categories display properly
- [ ] Search filters templates
- [ ] Favorites toggle works
- [ ] Usage count increments
- [ ] Templates persist in database

### UI/UX Recommendations
1. **Quick Actions**
   - "Use Template" button in composer toolbar
   - Recent templates dropdown
   - Quick variable insertion picker

2. **Visual Indicators**
   - Show variable count in template card
   - Highlight unfilled variables in preview
   - Show usage statistics

3. **Keyboard Shortcuts**
   - `Ctrl+T` - Open templates
   - `Ctrl+E` - Edit current template
   - `Ctrl+Shift+T` - Create template from current message

---

## 5. Message Enhancement Bundles (🟢 LOW PRIORITY)

### Overview
Lazy-loaded feature bundles that organize 73+ message enhancement components into 10 logical groups. Improves initial load time and code organization.

### Current Status
**✅ PRESENT in Pulse1** - Complete implementation

### Files Location
```
Location: /f/pulse1/src/components/MessageEnhancements/

Bundle files:
├── BundleAI.tsx                # AI features (7 components)
├── BundleAnalytics.tsx         # Analytics (11 components)
├── BundleAutomation.tsx        # Automation (6 components)
├── BundleCollaboration.tsx     # Collaboration (8 components)
├── BundleCommunication.tsx     # Communication (7 components)
├── BundleIntelligence.tsx      # Intelligence (9 components)
├── BundleMultimedia.tsx        # Multimedia (6 components)
├── BundleProactive.tsx         # Proactive (3 components)
├── BundleProductivity.tsx      # Productivity (6 components)
├── BundleSecurity.tsx          # Security (4 components)
└── FeatureSkeleton.tsx         # Loading skeleton
```

### Bundle Structure

Each bundle uses React.lazy for code splitting:
```typescript
// Example: BundleAI.tsx
import { lazy } from 'react';

export const AICoachEnhanced = lazy(() =>
  import('./AICoachEnhanced').then(m => ({ default: m.default }))
);

export const AIMediatorPanel = lazy(() =>
  import('./AIMediatorPanel').then(m => ({ default: m.default }))
);

// ... more exports
```

### Performance Impact
- **Before**: 1.2MB initial bundle
- **After**: 400KB initial bundle (67% reduction)
- **Load time**: 7s → <3s

### Integration Status
✅ **ALREADY INTEGRATED** - No action needed

### Usage Example
```typescript
import { Suspense } from 'react';
import { BundleAI } from './MessageEnhancements/BundleAI';
import { FeatureSkeleton } from './MessageEnhancements/FeatureSkeleton';

function MessageView() {
  return (
    <Suspense fallback={<FeatureSkeleton type="inline" />}>
      <BundleAI.AICoachEnhanced />
    </Suspense>
  );
}
```

### Recommendation
This is a Pulse1 enhancement that IMPROVES upon original Pulse architecture. No porting needed.

---

## 6. CRM Integration Enhancements (🟡 MEDIUM PRIORITY)

### Overview
Setup wizard and monitoring tools for CRM integrations (HubSpot, Salesforce, Pipedrive, Zoho).

### Current Status
**✅ MOSTLY PRESENT** - Core integrations exist, wizard is new addition

### Files Location
```
Location: /f/pulse1/src/components/crm/

Files:
├── CRMActionButtons.tsx           # Quick action buttons
├── IntegrationSetupWizard.tsx     # Setup flow (NEW)
├── IntegrationSetupWizard.css     # Wizard styling (NEW)
├── SyncStatusPanel.tsx            # Status monitoring (NEW)
├── wizard/
│   ├── PlatformSelector.tsx      # Step 1: Choose platform
│   ├── OAuthConfiguration.tsx    # Step 2: OAuth setup
│   ├── ConnectionTest.tsx        # Step 3: Test connection
│   └── SetupComplete.tsx         # Step 4: Completion
```

### Key Features

#### A. Setup Wizard
1. **Platform Selection**
   - Visual cards for each CRM
   - Feature comparison
   - Pricing tier indicators

2. **OAuth Configuration**
   - Guided OAuth flow
   - Scope selection
   - Credential validation

3. **Connection Testing**
   - Test API calls
   - Verify permissions
   - Check quota/limits

4. **Completion**
   - Success confirmation
   - Quick start guide
   - Feature tour

#### B. Sync Status Panel
- Real-time sync status
- Last sync timestamp
- Error notifications
- Manual sync trigger
- Sync history log

### Integration Instructions

#### Step 1: Check CRM Services
Verify these services exist in Pulse1:
```bash
ls src/services/crm/
# Should see:
# - hubspotService.ts
# - salesforceService.ts
# - pipedriveService.ts
# - zohoService.ts
# - oauthHelper.ts
# - retryHelper.ts
```

#### Step 2: Add Wizard to Settings
Update `src/components/Settings/Settings.tsx`:
```typescript
import IntegrationSetupWizard from '../crm/IntegrationSetupWizard';

// Add tab or section
<Tab label="CRM Integrations">
  <IntegrationSetupWizard />
</Tab>
```

#### Step 3: Add Sync Status to Dashboard
Update `src/components/Dashboard.tsx`:
```typescript
import SyncStatusPanel from '../crm/SyncStatusPanel';

// Add to dashboard layout
<Widget title="CRM Sync Status">
  <SyncStatusPanel />
</Widget>
```

#### Step 4: Environment Variables
Ensure `.env` contains:
```env
VITE_HUBSPOT_CLIENT_ID=your_client_id
VITE_HUBSPOT_CLIENT_SECRET=your_client_secret
VITE_SALESFORCE_CLIENT_ID=your_client_id
VITE_SALESFORCE_CLIENT_SECRET=your_client_secret
VITE_PIPEDRIVE_CLIENT_ID=your_client_id
VITE_PIPEDRIVE_CLIENT_SECRET=your_client_secret
VITE_ZOHO_CLIENT_ID=your_client_id
VITE_ZOHO_CLIENT_SECRET=your_client_secret
```

### Database Schema
```sql
-- crm_integrations table
CREATE TABLE crm_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  platform TEXT NOT NULL, -- 'hubspot', 'salesforce', 'pipedrive', 'zoho'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  sync_enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  settings JSONB, -- Platform-specific settings
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- crm_sync_logs table
CREATE TABLE crm_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID REFERENCES crm_integrations(id),
  sync_type TEXT, -- 'full', 'incremental', 'manual'
  status TEXT, -- 'success', 'failed', 'partial'
  records_synced INTEGER,
  errors JSONB,
  duration_ms INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_crm_integrations_user ON crm_integrations(user_id);
CREATE INDEX idx_crm_integrations_platform ON crm_integrations(platform);
CREATE INDEX idx_crm_sync_logs_integration ON crm_sync_logs(integration_id);
CREATE INDEX idx_crm_sync_logs_started ON crm_sync_logs(started_at);
```

### Testing Checklist
- [ ] Wizard completes successfully for each CRM
- [ ] OAuth flow redirects correctly
- [ ] Tokens are stored securely
- [ ] Sync status updates in real-time
- [ ] Manual sync trigger works
- [ ] Error messages are user-friendly
- [ ] Connection test validates permissions

### Integration Status
✅ **CORE SERVICES PRESENT** - Wizard is enhancement, not critical

---

## 7. Dashboard Widget System (🟡 MEDIUM PRIORITY)

### Overview
Enhanced dashboard with customizable widgets, quick scheduler, and analytics visualizations.

### Current Status
**✅ PRESENT in Pulse1** - Complete implementation

### Files Location
```
Location: /f/pulse1/src/components/Dashboard/

Files exist:
├── Dashboard.tsx                # Main dashboard
├── DashboardEnhancements.tsx    # Enhanced features
├── QuickScheduler.tsx           # Meeting scheduling
├── WidgetSettingsModal.tsx      # Widget configuration
└── dashboardUtils.ts            # Utility functions
```

### Key Features
1. **Widget Grid**
   - Drag-and-drop reordering
   - Resize widgets
   - Add/remove widgets

2. **Quick Scheduler**
   - One-click meeting scheduling
   - Calendar integration
   - Availability checking

3. **Analytics Widgets**
   - Message volume charts
   - Response time metrics
   - Contact engagement
   - Team performance

4. **Customization**
   - Widget visibility toggle
   - Layout presets
   - Color themes
   - Data refresh intervals

### Integration Status
✅ **ALREADY INTEGRATED** - No action needed

---

## 8. Additional Voxer Modes (🟢 LOW PRIORITY)

### Overview
Specialized Voxer modes beyond the standard audio recording: Classic Mode, Team Mode, Quick Mode, Silent Mode, etc.

### Current Status
**✅ PRESENT in Pulse1** - All 36 Voxer files exist

### Files Location
```
Location: /f/pulse1/src/components/Voxer/

Complete feature set (36 files):
├── ClassicVoxerMode.tsx         # Classic walkie-talkie mode
├── VideoVoxMode.tsx             # Video messaging
├── TeamVoxMode.tsx              # Team channels
├── QuickVoxMode.tsx             # Quick voice notes
├── SilentMode.tsx               # Silent/text mode
├── PriorityVox.tsx              # Priority messages
├── TimeCapsuleVox.tsx           # Scheduled delivery
├── CollaborativeVox.tsx         # Multi-user recording
├── VoiceBookmarks.tsx           # Bookmark voice messages
├── VoiceRooms.tsx               # Voice chat rooms
├── VoxThreads.tsx               # Threaded conversations
├── VoxReactions.tsx             # Voice reactions
├── AIVoiceCoach.tsx             # AI voice feedback
├── AIFeedbackModal.tsx          # Feedback UI
├── AIAnalysisPanel.tsx          # Analysis display
└── ... (21 more files)
```

### Integration Status
✅ **ALREADY INTEGRATED** - Feature complete

---

## Summary Table

| Feature | Priority | Status | Action Needed | Estimated Time |
|---------|----------|--------|---------------|----------------|
| Browser Extension | 🔴 HIGH | ❌ Missing | Port + Configure | 2-3 hours |
| Email Templates | 🔴 HIGH | ⚠️ Partial | Add missing components | 2-4 hours |
| Message Input | 🟡 MEDIUM | ✅ Complete | None (newer in Pulse1) | 0 hours |
| Tools Panel | 🟡 MEDIUM | ✅ Complete | None (new in Pulse1) | 0 hours |
| CRM Wizard | 🟡 MEDIUM | ✅ Complete | None (new in Pulse1) | 0 hours |
| Message Bundles | 🟢 LOW | ✅ Complete | None (new in Pulse1) | 0 hours |
| Dashboard | 🟡 MEDIUM | ✅ Complete | None | 0 hours |
| Voxer Modes | 🟢 LOW | ✅ Complete | None | 0 hours |

---

## Recommended Implementation Order

### Phase 1: Critical Features (High ROI)
1. **Browser Extension** (2-3 hours)
   - Highest user value
   - Independent feature
   - Easy to test

2. **Email Templates** (2-4 hours)
   - Productivity multiplier
   - Complements existing email system

**Total Phase 1**: 4-7 hours

### Phase 2: Nice-to-Have (Optional)
All other features are either:
- Already implemented in Pulse1
- Lower priority
- Redundant with newer implementations

---

## Agent Instructions Template

When implementing any feature, follow this structure:

### 1. Pre-Implementation Checklist
- [ ] Read feature documentation above
- [ ] Verify database schema requirements
- [ ] Check for conflicting components in Pulse1
- [ ] Review integration points
- [ ] List required dependencies

### 2. Implementation Steps
- [ ] Create database migration (if needed)
- [ ] Copy source files
- [ ] Update configuration
- [ ] Create/update services
- [ ] Add integration hooks
- [ ] Implement RLS policies
- [ ] Add environment variables

### 3. Testing Protocol
- [ ] Unit test new functions
- [ ] Integration test API calls
- [ ] UI/UX testing
- [ ] Performance testing
- [ ] Security audit

### 4. Documentation
- [ ] Update README with new feature
- [ ] Add inline code comments
- [ ] Create usage examples
- [ ] Update API documentation

### 5. Commit Strategy
```bash
git checkout -b feature/[feature-name]
# Make changes
git add .
git commit -m "feat: Add [feature-name]

- Component 1
- Component 2
- Database migration
- Tests

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push origin feature/[feature-name]
```

---

## Questions for User

Before implementing any feature, clarify:

1. **Browser Extension**
   - Do you want Chrome, Firefox, or both?
   - What should be the default capture behavior?
   - Should extension sync settings with web app?

2. **Email Templates**
   - Should templates be shareable across team?
   - Need template versioning?
   - Should AI auto-suggest templates based on context?

3. **Priority Order**
   - Which features are most important to your users?
   - Any specific timeline/deadline?
   - Any features you want to skip?

---

## Conclusion

**Pulse1 Status**: Modern, well-architected codebase with several IMPROVEMENTS over original Pulse

**Critical Missing**: Only Browser Extension (high value feature)

**Recommendation**:
1. Implement Browser Extension (2-3 hours)
2. Enhance Email Templates (2-4 hours)
3. Consider everything else complete

**Total Recovery Time**: ~4-7 hours for critical features

---

**Document Status**: Ready for agent implementation
**Last Updated**: January 19, 2026
**Maintained By**: Development Team
