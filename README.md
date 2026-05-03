<!--
⚠ OPS TODO — production cron paths returning 401 until configured:
  https://github.com/FatherSonOne/Pulse-1/issues/34
  (5-min task — set ALTER DATABASE postgres SET app.cron_secret + Edge Functions CRON_SECRET env)
-->

# 🚀 Pulse - Next-Generation Unified Communication Platform

[![Version](https://img.shields.io/badge/version-27.0.0-blue.svg)](https://github.com/FatherSonOne/Pulse-1)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-2.87-3ecf8e.svg)](https://supabase.com/)

> **AI-powered unified messaging platform** that brings together SMS, email, Slack, and more into a single intelligent inbox with advanced AI features, CRM integrations, and real-time collaboration tools.

[Live Demo](#) • [Documentation](docs/) • [Contributing](#contributing) • [Report Bug](https://github.com/FatherSonOne/Pulse-1/issues)

---

## ✨ Key Features

### 🤖 **AI-Powered Intelligence**
- **Multi-Provider AI Support**: Gemini 2.5 Flash, GPT-4o, Claude Sonnet 4
- **AI Coach**: Real-time message suggestions and tone analysis
- **Conversation Intelligence**: Automatic summaries, sentiment analysis, and insights
- **Smart Auto-Response**: AI-generated contextual replies
- **Message Brainstorming**: 13 AI functions including SCAMPER, Six Thinking Hats frameworks

### 🎙️ **Voxer Voice Features** (Phase 1 Complete ✅)
- **AI Analysis**: Automatic voice message transcription with summaries, action items, and sentiment
- **Pre-Send Feedback**: Get AI suggestions before sending messages
- **Real-time Transcription**: Live speech-to-text during recording
- **Audio Enhancement**: Automatic noise reduction, voice clarity, and normalization
- **Settings Control**: Toggle all AI features on/off per preference

### 📱 **Unified Inbox**
- **Multi-Platform**: SMS, Email, Slack, internal messages in one place
- **Smart Organization**: Auto-clustering, labels, folders, and archives
- **Real-time Sync**: Live updates across all devices
- **Advanced Search**: Fuzzy search with Fuse.js across all message types
- **Contact Management**: Unified contact profiles across platforms

### 🔗 **CRM Integrations** (4 Platforms ✅)
- **HubSpot**: Tasks, deals, calls, contacts with OAuth 2.0
- **Salesforce**: Opportunities, activities, leads with SOQL queries
- **Pipedrive**: Activities, deals, persons with REST API
- **Zoho CRM**: Tasks, deals, contacts, calls with full CRUD
- **Bi-directional Sync**: Automatic data synchronization
- **Smart Retry Logic**: Exponential backoff and token refresh

### 💬 **Message Enhancements** (73 Components)
Organized into 10 feature bundles with lazy loading:

#### 🎨 **AI Features**
- AI Coach Enhanced
- AI Mediator Panel
- Voice Context Extraction
- Translation Widget
- Message Formatting
- Smart Compose
- Context Awareness

#### 📊 **Analytics**
- Response Time Tracking
- Engagement Scoring
- Conversation Flow Visualization
- Proactive Insights Panel
- Message Heat Map
- Interaction Patterns
- Communication Metrics
- Performance Dashboard
- Trend Analysis
- Predictive Indicators
- Network Graph

#### 🤝 **Collaboration**
- Thread Collaboration
- Message Pinning
- Shared Workspace
- Team Mentions
- File Sharing
- Co-editing
- Live Presence
- Activity Feed

#### ⚡ **Productivity**
- Smart Templates
- Message Scheduling
- Quick Replies
- Keyboard Shortcuts
- Batch Operations
- Smart Folders

#### 🧠 **Intelligence**
- Contact Insights
- Message Bookmarks
- Follow-up Reminders
- Priority Inbox
- Smart Filters
- Context Cards
- Relationship Tracking
- AI Suggestions
- Conversation Timeline

#### 🔔 **Proactive Features**
- Smart Reminders
- Sentiment Timeline
- Conversation Triggers
- Notification Rules
- Action Items
- Deadline Tracking

#### 💬 **Communication**
- Voice Recorder
- Emoji Picker
- GIF Integration
- Rich Text Formatting
- Markdown Support
- Code Blocks

#### 🤖 **Automation**
- Auto-Response Rules
- Draft Manager
- Message Templates
- Workflow Automation
- Scheduled Messages
- Bulk Actions
- Smart Routing

#### 🔒 **Security**
- Message Encryption (End-to-end)
- Read Time Estimation
- Message Versioning
- Smart Folders with Access Control
- Audit Logs
- Secure Storage

#### 📎 **Multimedia**
- Translation Hub (90+ languages)
- Analytics Export
- Templates Library
- Attachment Manager
- Backup & Sync
- Smart Suggestions
- Media Gallery

---

## 🚀 Performance

**Optimized for Speed:**
- ✅ **66% bundle size reduction** (1.2MB → 400KB)
- ✅ **57% faster load times** (7s → <3s)
- ✅ **Lighthouse score target**: >90
- ✅ **Code splitting**: 10 feature bundles with lazy loading
- ✅ **React.memo**: Optimized expensive components
- ✅ **Intelligent caching**: 50-65% API call reduction

---

## 🛠️ Tech Stack

### **Frontend**
- **React 19.0** with TypeScript 5.6
- **Vite** - Lightning-fast build tool
- **TailwindCSS** - Utility-first styling
- **Framer Motion** - Smooth animations
- **React Router** - Client-side routing

### **Backend & Database**
- **Supabase** - PostgreSQL database with real-time subscriptions
- **Row Level Security (RLS)** - Secure data access
- **Edge Functions** - Serverless API endpoints

### **AI & ML**
- **Google Gemini 2.5 Flash** - Fast clustering and variations
- **GPT-4o** - Nuanced analysis and expansions
- **Claude Sonnet 4** - Strategic synthesis and gap analysis
- **Gemini Embeddings** - Semantic similarity detection

### **Integrations**
- **Slack Web API** - Slack workspace integration
- **Twilio** - SMS messaging (optional)
- **HubSpot, Salesforce, Pipedrive, Zoho** - CRM platforms
- **Google OAuth** - Secure authentication

### **Testing**
- **Vitest** - Unit & integration testing
- **Playwright** - E2E testing
- **MSW** - API mocking
- **React Testing Library** - Component testing

### **Mobile**
- **Capacitor 8.0** - Native mobile app wrapper
- **Android SDK** - Android app deployment

---

## 📦 Installation

### **Prerequisites**
- Node.js 18+ and npm
- Supabase account
- Google Gemini API key
- (Optional) OpenAI, Anthropic, CRM API keys

### **Quick Start**

1. **Clone the repository**
   ```bash
   git clone https://github.com/FatherSonOne/Pulse-1.git
   cd Pulse-1
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   VITE_GEMINI_API_KEY=your-gemini-api-key
   ```

4. **Set up Supabase database**
   ```bash
   # Install Supabase CLI
   npm install -g supabase

   # Link to your project
   npx supabase link --project-ref your-project-ref

   # Run migrations
   npx supabase db push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open in browser**
   ```
   http://localhost:5173
   ```

---

## 🧪 Testing

```bash
# Unit & integration tests
npm test

# Run tests once
npm run test:run

# Coverage report
npm run test:coverage

# E2E tests with Playwright
npm run test:e2e

# E2E with UI
npm run test:e2e:ui

# Debug E2E tests
npm run test:e2e:debug
```

---

## 📱 Mobile App (Android)

```bash
# Build and sync to Android
npm run android:build

# Open in Android Studio
npm run android:open

# Run on connected device
npm run android:run
```

---

## 📊 Build & Analysis

```bash
# Production build
npm run build

# Analyze bundle size with visualizer
npm run build:analyze

# Show bundle statistics
npm run build:stats
```

---

## 🗂️ Project Structure

```
pulse1/
├── src/
│   ├── components/          # React components
│   │   ├── MessageEnhancements/  # 73 feature components
│   │   ├── MessageInput/         # Message composition
│   │   ├── Messages.tsx          # Main messaging interface
│   │   └── Voxer.tsx             # Voice messaging
│   ├── services/            # Business logic
│   │   ├── crm/                  # CRM integrations
│   │   ├── brainstormService.ts  # AI brainstorming
│   │   ├── crmService.ts         # CRM main service
│   │   └── messageStore.ts       # Message state management
│   ├── store/               # Zustand state management
│   ├── types/               # TypeScript definitions
│   └── __tests__/           # Test files
├── supabase/
│   ├── migrations/          # Database migrations
│   └── config.toml          # Supabase configuration
├── docs/                    # Documentation
├── e2e/                     # End-to-end tests
└── android/                 # Android app (Capacitor)
```

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### **Development Workflow**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### **Commit Convention**
We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code refactoring
- `docs:` - Documentation changes
- `test:` - Test additions/changes
- `chore:` - Build process or auxiliary tool changes

---

## 📚 Documentation

Comprehensive documentation available in the `/docs` folder:

- [CRM Setup Guide](docs/CRM_SETUP_GUIDE.md) - Configure CRM integrations
- [Performance Optimization](docs/PERFORMANCE_OPTIMIZATION_STRATEGY.md) - Bundle size and speed improvements
- [Brainstorm Service](docs/BRAINSTORM_SERVICE_IMPLEMENTATION.md) - AI brainstorming features
- [Agent Orchestration](docs/AGENT_ORCHESTRATION.md) - Multi-agent AI coordination
- [Phase 1 Completion Reports](PHASE1-TASK1-COMPLETE.md) - Voxer AI features

---

## 🎯 Roadmap

### **Phase 1: Voxer AI Features** ✅ Complete
- [x] AI Analysis Integration
- [x] Pre-Send AI Feedback
- [x] Real-time Transcription
- [x] Audio Enhancement

### **Phase 2: Video & Advanced Playback** 🚧 In Progress
- [ ] Video Vox Testing
- [ ] Advanced Playback Controls
- [ ] Video UI Polish

### **Phase 3: Performance & Scale**
- [ ] Complete Suspense wrapping (10/58 components done)
- [ ] Server-side rendering (SSR)
- [ ] Redis caching layer
- [ ] WebSocket optimizations

### **Phase 4: Mobile Excellence**
- [ ] iOS app (React Native or Capacitor)
- [ ] Push notifications
- [ ] Offline mode
- [ ] App store deployment

### **Phase 5: Enterprise Features**
- [ ] Team workspaces
- [ ] Admin dashboard
- [ ] Advanced analytics
- [ ] Custom integrations API
- [ ] Webhooks
- [ ] SSO/SAML authentication

---

## 📈 Performance Metrics

Current production metrics:

- **Initial Bundle**: 400KB (67% reduction)
- **Time to Interactive**: <3s
- **First Contentful Paint**: <1.5s
- **Lighthouse Score**: 90+ (target)
- **API Response Time**: <200ms (p95)
- **AI Analysis Time**: 1-3s depending on provider

---

## 🔒 Security

- **End-to-end encryption** for sensitive messages
- **Row Level Security (RLS)** in Supabase
- **OAuth 2.0** for all integrations
- **API key rotation** support
- **Secure token storage** in localStorage (encrypted)
- **HTTPS only** in production
- **CSP headers** configured

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **AI Providers**: Google Gemini, OpenAI, Anthropic
- **Backend**: Supabase for amazing real-time database
- **UI Inspiration**: Modern messaging apps like Slack, Discord, Telegram
- **Community**: Open source contributors and early testers

---

## 📞 Contact & Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/FatherSonOne/Pulse-1/issues)
- **Email**: jehovahsneaky83@gmail.com
- **Documentation**: [Full docs](docs/)

---

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=FatherSonOne/Pulse-1&type=Date)](https://star-history.com/#FatherSonOne/Pulse-1&Date)

---

<div align="center">

**Built with ❤️ by the Pulse Team**

[⬆ Back to Top](#-pulse---next-generation-unified-communication-platform)

</div>
