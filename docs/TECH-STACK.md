# Pulse 1.1 - Complete Technical Stack Documentation

> **Purpose**: Comprehensive technical reference for AI assistants (Perplexity, Claude, etc.) to understand the full architecture, dependencies, and capabilities of the Pulse application.

---

## Quick Reference

| Category | Technology |
|----------|------------|
| **Frontend** | React 19.2.1 + TypeScript 5.8.2 |
| **Build Tool** | Vite 6.2.0 |
| **State Management** | Zustand 5.0.9 |
| **Backend/Database** | Supabase (PostgreSQL + Auth) |
| **AI Primary** | Google Gemini 2.5 Flash |
| **AI Search** | Perplexity Sonar API |
| **Server** | Express 5.2.1 (API Proxy) |

---

## 1. Core Framework & Build System

### Frontend Stack
```
React 19.2.1          - UI framework (latest with concurrent features)
React DOM 19.2.1      - React rendering engine
React Router DOM 7.10.1 - Client-side routing with data APIs
TypeScript 5.8.2      - Static typing and enhanced DX
Vite 6.2.0            - Lightning-fast HMR and optimized builds
```

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "experimentalDecorators": true,
    "paths": { "@/*": ["./*"] }
  }
}
```

### Vite Configuration
- Dev server: `localhost:3000`
- Environment: `GEMINI_API_KEY` exposed via `process.env`
- Testing: Vitest with jsdom environment
- Coverage: v8 provider

---

## 2. Dependencies (package.json)

### Production Dependencies

#### Core Framework
```json
"react": "^19.2.1",
"react-dom": "^19.2.1",
"react-router-dom": "^7.10.1",
"zustand": "^5.0.9"
```

#### AI & Generative Services
```json
"@google/genai": "^1.31.0",      // Google Gemini AI SDK
"axios": "^1.13.2"               // HTTP client for Perplexity API
```

#### Backend & Database
```json
"@supabase/supabase-js": "^2.87.1"  // Supabase client
```

#### Communication Integrations
```json
"@slack/web-api": "^7.13.0",    // Slack messaging
"@slack/oauth": "^3.0.4",       // Slack OAuth
"socket.io-client": "^4.8.1"    // Real-time WebSocket
```

#### CRM Platforms
```json
"@hubspot/api-client": "^13.4.0",  // HubSpot CRM
"hubspot": "^0.0.3",               // HubSpot utilities
"jsforce": "^3.10.10",             // Salesforce API
"pipedrive": "^30.8.0"             // Pipedrive CRM
```

#### UI Components
```json
"lucide-react": "^0.561.0",        // Icon library
"react-icons": "^5.5.0",           // Additional icons
"react-hot-toast": "^2.6.0"        // Toast notifications
```

#### Maps & Location
```json
"@react-google-maps/api": "^2.20.7"  // Google Maps React
```

#### Utilities
```json
"uuid": "^13.0.0",          // Unique ID generation
"date-fns": "^4.1.0"        // Date manipulation
```

#### Server (API Proxy)
```json
"express": "^5.2.1",        // Express server
"cors": "^2.8.5"            // CORS middleware
```

### Dev Dependencies
```json
"@vitejs/plugin-react": "^5.0.0",
"@testing-library/react": "^16.3.1",
"@testing-library/jest-dom": "^6.9.1",
"@testing-library/user-event": "^14.6.1",
"vitest": "^4.0.15",
"jsdom": "^27.3.0",
"@types/node": "^22.19.3"
```

---

## 3. Project Structure

```
pulse/
├── src/
│   ├── components/           # React UI components
│   │   ├── admin/           # Admin dashboard components
│   │   ├── crm/             # CRM integration UI
│   │   ├── decisions/       # Decision tracking
│   │   ├── health/          # Team health monitoring
│   │   ├── outcomes/        # Goal/outcome tracking
│   │   ├── tasks/           # Task management
│   │   └── Dashboard/       # Dashboard widgets
│   ├── services/            # Business logic & API integrations
│   ├── types/               # TypeScript interfaces
│   ├── hooks/               # Custom React hooks
│   ├── store/               # Zustand state management
│   ├── context/             # React context providers
│   ├── test/                # Test setup & utilities
│   ├── App.tsx              # Root component
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
├── supabase/
│   └── migrations/          # Database migrations
├── development/             # Development guides
├── docs/                    # Documentation
├── server.js                # Express API proxy
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 4. AI Integration Layer

### Google Gemini AI (`src/services/geminiService.ts`)

**Models Used:**
- `gemini-2.5-flash` - Primary model for most operations
- `gemini-2.5-flash-lite` - Lightweight tasks
- `gemini-3-pro-preview` - Advanced reasoning
- `veo-3.1-fast-generate-preview` - Video generation

**Capabilities:**

| Function | Description |
|----------|-------------|
| `generateSearchResponse()` | Web search with grounding |
| `generateMapsResponse()` | Location-based queries |
| `generateImage()` | Image generation |
| `generateProImage()` | High-quality image generation |
| `editImage()` | Image editing/modification |
| `transcribeMedia()` | Audio/video transcription |
| `generateMeetingNote()` | Extract notes from meetings |
| `generateDailyBriefing()` | Daily summary generation |
| `analyzeVideo()` | Video content analysis |
| `generateVideo()` | AI video generation (Veo) |
| `generateSpeech()` | Text-to-speech synthesis |
| `chatWithBot()` | Conversational AI with context |
| `analyzeDraftIntent()` | Classify message intent |
| `extractTaskFromMessage()` | Task extraction from text |
| `analyzeOutcomeProgress()` | Goal progress analysis |
| `analyzeTeamHealth()` | Team communication metrics |
| `generateNudge()` | Proactive suggestions |
| `generateHandoffSummary()` | Context handoff summaries |
| `analyzeVoiceMemo()` | Voice memo analysis |
| `generateChannelArtifact()` | Channel documentation |
| `generateEmailDraft()` | Email composition |
| `improveEmailText()` | Email improvement |
| `generateEmailSuggestions()` | Email suggestions |

### Perplexity AI (`src/services/perplexityService.ts`)

**Endpoint:** `https://api.perplexity.ai/chat/completions`

**Models:**
- `llama-3.1-sonar-small-128k-online`
- `llama-3.1-sonar-large-128k-online`
- `llama-3.1-sonar-huge-128k-online`

**Capabilities:**

| Function | Description |
|----------|-------------|
| `queryPerplexity()` | Real-time web search |
| `streamPerplexity()` | Streaming search responses |
| `quickResearch()` | Fast research queries |
| `deepResearch()` | Comprehensive research |
| `formatCitations()` | Citation formatting |
| `validatePerplexityKey()` | API key validation |

---

## 5. Communication Integrations

### Slack Integration (`src/services/slackService.ts`)

**API Methods:**
- `conversations.list` - List channels
- `conversations.history` - Fetch messages
- `users.info` - User details
- `auth.test` - Connection verification

**Features:**
- Channel listing with bot membership verification
- Message fetching with thread support
- User info resolution
- Unified message format output

### Gmail Integration (`src/services/gmailService.ts`)

**API Endpoint:** `https://gmail.googleapis.com/gmail/v1/`

**Features:**
- Inbox message fetching
- Base64url decoding for email bodies
- Thread and label management
- Unread count tracking
- HTML and plain text support

### Twilio SMS (`src/services/twilioService.ts`)

**API Endpoint:** `https://api.twilio.com/2010-04-01/`

**Features:**
- SMS message fetching
- Phone number formatting
- Direction classification (inbound/outbound)
- Message status tracking

### Unified Inbox (`src/services/unifiedInboxService.ts`)

**Supported Platforms:**
- Slack
- Email (Gmail)
- SMS (Twilio)
- Pulse (native)
- Discord (framework ready)
- Teams (framework ready)

**Features:**
- Cross-platform message normalization
- Deduplication
- Conversation graph construction
- Unified search

---

## 6. CRM Integration Layer

### Multi-Platform CRM (`src/services/crmService.ts`)

**Supported Platforms:**
| Platform | Status | Features |
|----------|--------|----------|
| HubSpot | ✅ Full | Contacts, Companies, Deals |
| Salesforce | 🔄 Framework | Auth ready, sync pending |
| Pipedrive | 🔄 Framework | Auth ready, sync pending |

**HubSpot Integration:**
```typescript
// Full sync capabilities
- Contact sync with custom properties
- Company sync with relationship mapping
- Deal sync with pipeline stages
- Bidirectional updates
- Webhook support for real-time sync
```

### Smart Groups (`src/services/smartGroupService.ts`)

Dynamic grouping based on CRM criteria:
- Deal stage filters
- Contact properties
- Custom rules engine
- Auto-updating membership

### CRM Actions (`src/services/crmActionsService.ts`)

Trigger CRM operations from chat:
- Create tasks
- Update deal stages
- Add notes
- Log activities

---

## 7. Database Schema (Supabase/PostgreSQL)

### Core Tables

```sql
-- Users
users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Platform Integrations
integrations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users,
  platform TEXT, -- slack, gmail, sms, discord, teams
  workspace_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN,
  metadata JSONB,
  UNIQUE(user_id, platform, workspace_id)
)

-- Unified Messages
unified_messages (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users,
  platform TEXT,
  external_id TEXT,
  channel_id UUID,
  sender_id UUID REFERENCES contacts,
  content TEXT,
  content_type TEXT,
  thread_id TEXT,
  reply_to_id UUID,
  timestamp TIMESTAMPTZ,
  is_read BOOLEAN,
  is_starred BOOLEAN,
  tags TEXT[],
  metadata JSONB
)

-- Contacts
contacts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users,
  platform TEXT,
  external_id TEXT,
  name TEXT,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  company TEXT,
  role TEXT,
  metadata JSONB
)

-- CRM Tables
crm_integrations, crm_contacts, crm_companies, crm_deals, crm_sync_logs

-- Feature Tables
decisions, decision_votes, tasks, outcomes
in_app_messages, message_interactions, user_retention_cohorts
ephemeral_workspaces, chat_messages
```

### Row-Level Security (RLS)
All tables enforce user isolation:
```sql
CREATE POLICY "Users can only access own data"
ON table_name FOR ALL
USING (auth.uid() = user_id);
```

---

## 8. Component Architecture

### Main Views
| Component | Purpose |
|-----------|---------|
| `Dashboard.tsx` | Main dashboard with widgets |
| `Messages.tsx` | Unified message interface |
| `Calendar.tsx` | Google Calendar integration |
| `Contacts.tsx` | Contact management |
| `Settings.tsx` | User preferences |
| `LiveAI.tsx` | AI assistant interface |
| `Archives.tsx` | Message archives |

### Feature Components
| Component | Purpose |
|-----------|---------|
| `ChatInterface.tsx` | Main chat component |
| `UnifiedInbox.tsx` | Cross-platform inbox |
| `AdminDashboard.tsx` | System administration |
| `ContactsMap.tsx` | Google Maps for contacts |

### Health & Collaboration
| Component | Purpose |
|-----------|---------|
| `SocialHealthMonitor.tsx` | Team communication health |
| `ContextHandoff.tsx` | Context passing between members |
| `DecisionPanel.tsx` | Decision tracking with voting |
| `TaskPanel.tsx` | Task management |
| `OutcomeTracker.tsx` | Goal/outcome tracking |

### Admin Components
| Component | Purpose |
|-----------|---------|
| `AdminMessageEditor.tsx` | In-app message campaigns |
| `IntegrationManager.tsx` | API integration management |
| `WebhookManager.tsx` | Webhook configuration |

---

## 9. State Management

### Zustand Store (`src/store/chatstore.ts`)
```typescript
interface ChatStore {
  currentUser: User | null;
  workspaceId: string | null;
  messages: Message[];
  workspaceDuration: number;
}
```

### React Context
- `ChatContext` - Chat-related state and methods
- Provider pattern for component trees

---

## 10. Authentication & Security

### Authentication Methods
- **Google OAuth** - Primary authentication
- **Microsoft OAuth** - Framework ready
- **Session Management** - localStorage persistence

### Encryption (`src/services/encryption.ts`)
- **LibSodium.js** - Client-side encryption
- **crypto_box** - Public-key encryption
- **Ephemeral Workspaces** - Time-limited encrypted chats

### Security Features
- Row-level security in Supabase
- OAuth tokens for third-party services
- API key management via environment variables

---

## 11. API Proxy Server (`server.js`)

Express server for secure API proxying:

```javascript
// Port 3003
// CORS enabled for localhost:3000, 3001, 3002

Endpoints:
POST /api/slack/proxy   - Proxy Slack API requests
POST /api/gmail/proxy   - Proxy Gmail API requests
POST /api/twilio/proxy  - Proxy Twilio API requests
GET  /api/health        - Health check
```

---

## 12. Environment Variables

```bash
# AI Services
VITE_GEMINI_API_KEY=           # Google Gemini API key
VITE_PERPLEXITY_API_KEY=       # Perplexity API key

# Supabase
VITE_SUPABASE_URL=             # Supabase project URL
VITE_SUPABASE_ANON_KEY=        # Supabase anonymous key

# Communication
VITE_SLACK_BOT_TOKEN=          # Slack bot token

# Configuration
VITE_WORKSPACE_DURATION_MINUTES=60  # Default workspace duration
VITE_API_KEY=                  # Generic API key

# CRM (configured per integration)
# HubSpot, Salesforce, Pipedrive tokens stored in Supabase
```

---

## 13. Testing Infrastructure

### Framework
```bash
Vitest 4.0.15            # Test runner
Testing Library React    # Component testing
jsdom                    # DOM simulation
v8                       # Coverage provider
```

### Test Files
```
src/services/unifiedInboxService.test.ts
src/services/webhookService.test.ts
src/services/audioVoiceService.test.ts
src/services/channelExportService.test.ts
src/hooks/useMultiModalIntelligence.test.ts
src/components/MessagePrompt.test.tsx
src/test/integration/messageFlow.test.ts
```

### Commands
```bash
npm test              # Watch mode
npm run test:run      # Single run
npm run test:coverage # Coverage report
```

---

## 14. Build & Deployment

### Scripts
```bash
npm run dev           # Vite dev server (port 3000)
npm run build         # Production build
npm run preview       # Preview production build
npm run server        # API proxy server (port 3003)
npm test              # Run tests
```

### Build Output
- Optimized bundles via Vite
- Tree-shaking and code splitting
- Asset optimization

---

## 15. Key Features Summary

### Multi-Modal Communication
- Text, voice, images, files, video support
- Cross-platform message aggregation
- Real-time synchronization via WebSocket

### AI-Powered Intelligence
- Draft intent analysis (decision/FYI/request/brainstorm)
- Smart reply generation
- Meeting note extraction
- Daily briefing generation
- Image/video generation and editing
- Email composition assistance

### Team Collaboration
- Social health monitoring
- Context handoff between team members
- Decision tracking with voting
- Task extraction from messages
- Outcome/goal tracking

### CRM Integration
- Multi-platform sync (HubSpot primary)
- Smart groups based on CRM criteria
- CRM actions from chat
- Webhook support for real-time updates

### Admin & Analytics
- In-app messaging campaigns
- User segmentation & targeting
- Engagement tracking
- Retention cohort analysis

### Security
- End-to-end encryption
- Ephemeral encrypted workspaces
- Row-level security
- OAuth for third-party services

---

## 16. Design System

### CMF Nothing Brand
- **Primary Accent**: Red (#ef4444, #dc2626)
- **Theme**: Minimal dark mode
- **Typography**: System fonts, monospace for code
- **Spacing**: Consistent 4px grid
- **Components**: Zinc-based neutral palette

### CSS Architecture
- Component-scoped CSS files
- CSS custom properties for theming
- Dark/light mode support
- Responsive design patterns

---

## Version Information

| Component | Version |
|-----------|---------|
| Pulse | 1.1 |
| React | 19.2.1 |
| TypeScript | 5.8.2 |
| Vite | 6.2.0 |
| Node.js | 18+ recommended |

---

*Generated for Pulse 1.1 - December 2024*
