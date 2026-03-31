# EMAIL SECTION AUDIT

**Date:** 2026-03-30
**Auditor:** Claude Opus 4.6
**Section:** Email (Pulse AI-Powered Email Client)

---

## 1. File Inventory

### Components (36 files, ~13,600 lines)

| File | Lines | Description |
|------|-------|-------------|
| `src/components/Email/PulseEmailClientRedesign.tsx` | 1,159 | **ACTIVE** main email client (used via wrapper) |
| `src/components/Email/PulseEmailClient.tsx` | 908 | Original email client (superseded by Redesign) |
| `src/components/Email/EmailComposerModal.tsx` | 1,298 | Advanced composer with AI, confidential, scheduling |
| `src/components/Email/EmailSettingsModal.tsx` | 1,256 | Comprehensive settings (5 tabs) |
| `src/components/Email/EmailViewerNew.tsx` | 688 | Email detail/thread viewer with AI analysis |
| `src/components/Email/FilterManager.tsx` | 578 | Email filter rule builder UI |
| `src/components/Email/EmailTemplatesModalEnhanced.tsx` | 509 | Enhanced template manager |
| `src/components/Email/EmailListRedesign.tsx` | 398 | Modern email list with category tabs |
| `src/components/Email/TemplatesModal.tsx` | 386 | Basic template modal |
| `src/components/Email/RelationshipPanel.tsx` | 365 | Contact relationship context panel |
| `src/components/Email/MeetingExtractor.tsx` | 381 | AI meeting detection from email content |
| `src/components/Email/ActionItemExtractor.tsx` | 361 | AI action item extraction |
| `src/components/Email/LabelManager.tsx` | 364 | Label/tag management UI |
| `src/components/Email/FollowUpRemindersDropdown.tsx` | 324 | Follow-up reminder dropdown |
| `src/components/Email/EmailComposer.tsx` | 317 | Basic composer (legacy, used by EnhancedEmailClient) |
| `src/components/Email/FollowUpNudge.tsx` | 266 | Smart follow-up nudge component |
| `src/components/Email/DailyBriefing.tsx` | 250 | Morning email summary card |
| `src/components/Email/EmailViewer.tsx` | 222 | Basic email viewer (legacy) |
| `src/components/Email/EmailSidebarRedesign.tsx` | 219 | Modern sidebar with campaigns nav |
| `src/components/Email/SnoozeModal.tsx` | 168 | Snooze time picker modal |
| `src/components/Email/TemplateVariablesModal.tsx` | 149 | Template variable reference |
| `src/components/Email/ScheduleSendModal.tsx` | 145 | Schedule send time picker |
| `src/components/Email/EmailSidebar.tsx` | 130 | Original sidebar (legacy) |
| `src/components/Email/OfflineIndicator.tsx` | 127 | Offline status indicator |
| `src/components/Email/GoogleAuthStatus.tsx` | 121 | Google auth status/reconnect |
| `src/components/Email/KeyboardShortcutsModal.tsx` | 117 | Keyboard shortcuts reference |
| `src/components/Email/EmailClientWrapper.tsx` | 31 | Entry point wrapper (routes to Redesign) |
| `src/components/Email/index.tsx` | 16 | Barrel exports |
| **Campaigns/** | | |
| `src/components/Email/Campaigns/EmailCampaignBuilder.tsx` | 900 | Campaign wizard (setup/compose/review) |
| `src/components/Email/Campaigns/EmailCampaignsDashboard.tsx` | 555 | Campaign list and stats dashboard |
| `src/components/Email/Campaigns/SegmentBuilder.tsx` | 205 | Recipient segment builder |
| **Legacy / Dead** | | |
| `src/components/EmailLegacy.tsx` | 699 | **DEAD CODE** - Not imported anywhere |
| `src/components/Email/EnhancedEmailClient.tsx` | 451 | **DEAD CODE** - Exported but never consumed |
| `src/components/Email/EmailList.tsx` | 300 | Original list (only used by PulseEmailClient) |
| `src/components/Email/EmailViewer.tsx` | 222 | Original viewer (only used by EnhancedEmailClient) |
| `src/components/Email/EmailComposer.tsx` | 317 | Original composer (only used by EnhancedEmailClient) |

### Services (18 files, ~7,200 lines)

| File | Lines | Description |
|------|-------|-------------|
| `src/services/emailSyncService.ts` | 1,332 | **CORE** Gmail sync + Supabase cache (cached_emails) |
| `src/services/gmailService.ts` | 816 | Gmail API wrapper with OAuth token management |
| `src/services/offlineEmailStorage.ts` | 590 | IndexedDB offline cache + pending actions |
| `src/services/emailFilterService.ts` | 590 | Filter rule CRUD + execution engine |
| `src/services/emailSearchService.ts` | 521 | AI semantic + text search hybrid |
| `src/services/enhancedEmailService.ts` | 453 | **ORPHANED** - uses nonexistent `emails` table |
| `src/services/emailAIService.ts` | 416 | Gemini-powered analysis/drafts/tone |
| `src/services/emailTemplateService.ts` | 415 | Template CRUD with variables |
| `src/services/emailSignatureService.ts` | 302 | Signature CRUD via Supabase |
| `src/services/unifiedInboxService.ts` | 289 | Multi-source message aggregation |
| `src/services/unifiedInboxDb.ts` | 503 | DB layer for unified inbox |
| `src/services/emailSegmentService.ts` | 208 | Recipient segmentation |
| `src/services/emailCampaignService.ts` | 207 | Campaign CRUD + cache |
| `src/services/confidentialEmailService.ts` | 134 | **BROKEN** - calls `/api/email/confidential` (no route) |
| `src/services/emailAccountsService.ts` | 98 | **BROKEN** - calls `/api/email/accounts` (no route) |
| `src/services/smartComposeService.ts` | 77 | Scaffold - delegates to emailAIService |
| `src/services/emailMeetService.ts` | 46 | Google Meet link creation |

### Hooks (2 files, ~740 lines)

| File | Lines | Description |
|------|-------|-------------|
| `src/hooks/useEmailKeyboardShortcuts.ts` | 358 | Gmail-like keyboard shortcuts |
| `src/hooks/useOfflineEmails.ts` | 379 | Offline-first email hook |

### API Routes (9 files)

| File | Description |
|------|-------------|
| `src/pages/api/email/signatures.ts` | CRUD for signatures |
| `src/pages/api/email/labels.ts` | CRUD for labels |
| `src/pages/api/email/labels/sync.ts` | Label sync |
| `src/pages/api/email/filters.ts` | CRUD for filters |
| `src/pages/api/email/filters/[id]/toggle.ts` | Toggle filter enabled |
| `src/pages/api/email/search.ts` | Search API |
| `src/pages/api/email/bulk.ts` | Bulk operations |
| `src/pages/api/email/bulk/undo.ts` | Undo bulk operations |

### Database Tables

| Table | Location | Status |
|-------|----------|--------|
| `cached_emails` | Active migration | **ACTIVE** - Primary email cache |
| `email_threads` | Active migration | **ACTIVE** - Thread grouping |
| `emails` | Remote schema dump | **ORPHANED** - Only used by dead EnhancedEmailClient |
| `email_filters` | Active migration | Active |
| `email_signatures` | Backup migration | Active (via API routes) |
| `email_labels` | Backup migration | Active (via API routes) |
| `email_campaigns` | Active migration | Active |
| `email_segments` | Active migration | Active |
| `confidential_emails` | Backup migration | **UNKNOWN** - API route missing |
| `email_accounts` | Backup migration | **UNKNOWN** - API route missing |
| `scheduled_emails` | Backup migration | Unused by current code |
| `snoozed_emails` | Backup migration | Unused (snooze uses cached_emails field) |

### Tests (5 files, ~290 lines)

| File | Lines |
|------|-------|
| `src/services/__tests__/EmailAccountsService.test.ts` | 59 |
| `src/services/__tests__/EmailFilterService.test.ts` | 99 |
| `src/services/__tests__/EmailSignatureService.test.ts` | 79 |
| `src/services/__tests__/ConfidentialEmailService.test.ts` | 49 |
| `e2e/thread-navigation.spec.ts` | ~50 |

---

## 2. Architecture Diagram

```
                          ┌─────────────────────────────┐
                          │      EmailClientWrapper      │ ← App.tsx entry point
                          │   (routes to Redesign)       │
                          └──────────────┬───────────────┘
                                         │
                          ┌──────────────▼───────────────┐
                          │  PulseEmailClientRedesign     │ ← ACTIVE main component
                          │  (~1,159 lines, god component)│
                          └──┬──────┬──────┬──────┬──────┘
                             │      │      │      │
              ┌──────────────┤      │      │      ├──────────────┐
              │              │      │      │      │              │
    ┌─────────▼──┐  ┌───────▼──┐ ┌─▼──────▼─┐ ┌──▼──────────┐ ┌▼────────────────┐
    │ Sidebar    │  │EmailList │ │EmailViewer│ │  Composer    │ │ Campaigns       │
    │ Redesign   │  │Redesign  │ │New       │ │  Modal       │ │ Dashboard/      │
    │            │  │          │ │          │ │  (1,298 ln)  │ │ Builder         │
    └────────────┘  └──────────┘ └─────┬────┘ └──────┬───────┘ └─────────────────┘
                                       │             │
                    ┌──────────────────┤             ├──────────────────┐
                    │                  │             │                  │
              ┌─────▼─────┐    ┌──────▼──────┐ ┌────▼────────┐  ┌─────▼──────┐
              │SnoozeModal│    │Relationship │ │TemplatesModal│  │ScheduleSend│
              │           │    │Panel        │ │             │  │Modal       │
              └───────────┘    │MeetingExtr  │ └─────────────┘  └────────────┘
                               │ActionExtr   │
                               └─────────────┘


  ┌────────────── SERVICE LAYER ──────────────────────────────────────────┐
  │                                                                       │
  │  ┌────────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
  │  │ emailSyncService│◄──►│ gmailService  │◄──►│ Gmail REST API       │  │
  │  │ (cached_emails) │    │ (OAuth)       │    │ googleapis.com       │  │
  │  └───────┬────────┘    └──────────────┘    └──────────────────────┘  │
  │          │                                                            │
  │          ▼                                                            │
  │  ┌───────────────┐   ┌──────────────┐   ┌────────────────────────┐  │
  │  │offlineEmail   │   │emailAIService│──►│ Gemini API             │  │
  │  │Storage(IDB)   │   │              │   │ (gemini-2.5-flash)     │  │
  │  └───────────────┘   └──────────────┘   └────────────────────────┘  │
  │                                                                       │
  │  ┌────────────────┐   ┌──────────────┐   ┌────────────────────────┐  │
  │  │emailFilter     │   │emailTemplate │   │emailCampaignService    │  │
  │  │Service         │   │Service       │   │emailSegmentService     │  │
  │  └────────────────┘   └──────────────┘   └────────────────────────┘  │
  │                                                                       │
  │  ┌────────────────┐   ┌──────────────┐   ┌────────────────────────┐  │
  │  │emailSignature  │   │emailSearch   │   │smartComposeService     │  │
  │  │Service         │   │Service       │   │(scaffold)              │  │
  │  └────────────────┘   └──────────────┘   └────────────────────────┘  │
  │                                                                       │
  │  BROKEN / ORPHANED:                                                   │
  │  ┌────────────────┐   ┌──────────────┐   ┌────────────────────────┐  │
  │  │emailAccounts   │   │confidential  │   │enhancedEmailService    │  │
  │  │Service (no API)│   │EmailSvc(noAPI│   │(uses `emails` table)   │  │
  │  └────────────────┘   └──────────────┘   └────────────────────────┘  │
  └───────────────────────────────────────────────────────────────────────┘


  ┌────────────── DATABASE (Supabase) ────────────────────────────────┐
  │                                                                    │
  │  cached_emails ──────── email_threads                              │
  │  email_filters          email_signatures                           │
  │  email_labels           email_templates                            │
  │  email_campaigns        email_segments                             │
  │  confidential_emails*   email_accounts*    (* = orphaned routes)   │
  │  emails (legacy)        scheduled_emails (unused)                  │
  │  snoozed_emails (unused)                                           │
  └────────────────────────────────────────────────────────────────────┘
```

### State Management
- **No global store** - All state is managed via `useState` in `PulseEmailClientRedesign`
- Props are drilled 2-3 levels deep from the main client to sub-components
- Offline state managed in IndexedDB via `offlineEmailStorage`
- Sync state tracked in Supabase `sync_state` table

### External Integrations
1. **Gmail API** - Direct REST calls via `gmailService` using Supabase OAuth token
2. **Gemini 2.5 Flash** - AI analysis, draft generation, tone checking via `emailAIService`
3. **Google Calendar** - Meet link creation via `emailMeetService`
4. **Supabase** - Primary data store, auth, RLS
5. **IndexedDB** - Offline email cache

---

## 3. Feature Status Catalog

### Core Email Operations

| Feature | Status | Notes |
|---------|--------|-------|
| View inbox emails | ✅ Working | Loads from `cached_emails` via Supabase |
| View email detail | ✅ Working | Thread view with expanded messages |
| Compose new email | ✅ Working | Full composer with To/CC/BCC/Subject/Body |
| Reply to email | ✅ Working | Quotes original, sets In-Reply-To header |
| Reply All | ⚠️ Partial | Uses same handler as Reply - no CC auto-fill |
| Forward email | ⚠️ Partial | Uses Reply handler - no "Fwd:" prefix logic |
| Send email via Gmail | ✅ Working | RFC 2822 encoding, attachment support |
| Undo send (30s delay) | ✅ Working | Cancellable timeout with composer restore |
| Mark read/unread | ✅ Working | Syncs to Gmail + local cache |
| Star/unstar | ✅ Working | Syncs to Gmail + local cache |
| Archive email | ✅ Working | Removes INBOX label |
| Trash email | ✅ Working | Moves to Gmail trash |
| Delete email | ✅ Working | Permanent delete via Gmail API |
| Search emails | ✅ Working | Text search on cached_emails |
| Folder navigation | ✅ Working | 9 folders: inbox, starred, snoozed, sent, drafts, important, all, trash, spam |
| Category tabs (Primary/Social/etc.) | ⚠️ Partial | UI tabs present but categories depend on Gmail label sync which may be incomplete |
| Snooze emails | ✅ Working | Snooze modal with preset/custom times |
| Email threading | ✅ Working | Thread grouping by thread_id |
| Pagination | ❌ Broken | Loads fixed 50 emails, no pagination UI or infinite scroll |
| Attachment viewing | ⚠️ Partial | Shows `has_attachments` flag but no download/preview UI |

### Gmail Integration

| Feature | Status | Notes |
|---------|--------|-------|
| OAuth authentication | ✅ Working | Via Supabase Google provider |
| Token refresh | ✅ Working | Backend endpoint at `/api/google/refresh-token` |
| Session expiry handling | ✅ Working | Auth error banner + reconnect button + modal |
| Gmail sync (full) | ✅ Working | Fetches inbox + sent + starred, caches locally |
| Incremental sync | ⚠️ Partial | Uses date-based `after:` filter, not Gmail historyId |
| Auto-sync on mount | ✅ Working | Syncs if last sync > 5 minutes ago |
| Realtime push updates | ❌ Missing | No Gmail push notifications, relies on manual/timed sync |
| Gmail labels sync | ✅ Working | Fetches labels via API |
| Drafts sync | ⚠️ Partial | Drafts API exists in gmailService but not fully wired in sync |

### AI Features (Gemini)

| Feature | Status | Notes |
|---------|--------|-------|
| AI draft generation | ✅ Working | Generates from intent + tone in composer |
| Tone checking | ✅ Working | Checks body tone before send |
| Email analysis | ✅ Working | Summary, category, priority, sentiment, entities |
| Suggested replies | ✅ Working | AI generates quick reply suggestions |
| Action item extraction | ✅ Working | Component extracts tasks from email content |
| Meeting detection | ✅ Working | Detects meeting requests, dates, attendees |
| Smart Compose | ⚠️ Scaffold | Service exists but inline suggestion UI is a TODO |
| Daily briefing | ✅ Working | Morning summary card with priority emails |
| AI categorization | ⚠️ Partial | Stores category in DB but analysis isn't auto-triggered |
| Semantic search | ⚠️ Partial | Service exists but not connected to main search UI |

### Offline Support

| Feature | Status | Notes |
|---------|--------|-------|
| IndexedDB cache | ✅ Working | Stores emails with folder indexing |
| Offline indicator | ✅ Working | Compact indicator in header |
| Pending actions queue | ✅ Working | Queues markRead/star/archive/trash/delete |
| Auto-sync on reconnect | ✅ Working | Syncs pending actions when back online |
| Offline compose | ❌ Missing | No queuing of outgoing emails when offline |

### Email Management

| Feature | Status | Notes |
|---------|--------|-------|
| Email filters/rules | ✅ Working | CRUD + execution engine via emailFilterService |
| Filter rule builder UI | ✅ Working | FilterManager component with conditions/actions |
| Labels/tags | ✅ Working | CRUD via API routes + LabelManager UI |
| Templates | ✅ Working | CRUD with variables, categories, favorites |
| Signatures | ✅ Working | CRUD via API routes, HTML + text versions |
| Follow-up reminders | ✅ Working | Detects unanswered sent emails within 14 days |
| Auto-archive | ✅ Working | Archives read emails older than N days |
| Bulk operations | ⚠️ Partial | API routes exist but no bulk selection UI in client |
| Vacation responder | ⚠️ Partial | Settings UI present, service wired, but Gmail vacation API not called |

### Email Settings

| Feature | Status | Notes |
|---------|--------|-------|
| General settings | ✅ Working | AI toggle, theme, accent color, notifications |
| Gmail profile view | ✅ Working | Shows connected Gmail info |
| Sync status view | ✅ Working | Shows last sync time, email count, manual trigger |
| Automation tab | ⚠️ Partial | Vacation responder UI + blocked senders UI present |
| Accounts tab | ❌ Broken | Uses `emailAccountsService` which calls nonexistent API |
| Auto-archive config | ✅ Working | Configurable days threshold |
| Google Drive Quick Attach | 🔇 Stub | Opens drive.google.com in new tab only |

### Campaigns

| Feature | Status | Notes |
|---------|--------|-------|
| Campaign dashboard | ✅ Working | Lists campaigns with stats |
| Campaign builder wizard | ✅ Working | 3-step: Setup > Compose > Review |
| A/B subject testing | ⚠️ Partial | Fields exist but no splitting/tracking logic |
| Segment builder | ✅ Working | Rule-based recipient segments |
| AI content generation | ✅ Working | AI generates campaign body from prompt |
| Campaign scheduling | ⚠️ Partial | Schedule date stored but no scheduler/cron to execute |
| Campaign sending | ⚠️ Partial | Status changes to 'sending' but actual bulk send not implemented |
| Campaign analytics | 🔇 Stub | Stats fields exist, all zeros - no tracking pixels/webhooks |

### Security / Confidential Mode

| Feature | Status | Notes |
|---------|--------|-------|
| Confidential mode UI | ✅ Working | Expiration, passcode, disable forward/copy/print |
| Confidential metadata save | ❌ Broken | `confidentialEmailService` calls `/api/email/confidential` - no route exists |
| Access enforcement | ❌ Missing | No middleware to enforce confidential restrictions on viewer |

### Multi-Account / Unified Inbox

| Feature | Status | Notes |
|---------|--------|-------|
| Multiple email accounts | ❌ Broken | `emailAccountsService` calls `/api/email/accounts` - no route |
| Unified inbox component | ⚠️ Partial | Component exists (881 lines) but not wired to main email flow |
| Microsoft/IMAP support | 🔇 Stub | Types defined, no implementation |

### UX & Accessibility

| Feature | Status | Notes |
|---------|--------|-------|
| Dark mode support | ✅ Working | Full dark mode throughout |
| Light mode support | ✅ Working | Full light mode throughout |
| Keyboard shortcuts | ✅ Working | Gmail-like: j/k, c, r, a, e, #, s, etc. |
| Mobile responsive | ✅ Working | Sidebar collapse, list/viewer toggle |
| Zoom control (50-100%) | ✅ Working | Slider + density presets |
| Accent color customization | ✅ Working | Rose/Blue/Purple/Green |
| Relationship panel | ✅ Working | Shows contact history and context |

---

## 4. Issues by Severity

### RED - Critical (7)

| # | Issue | File(s) | Impact |
|---|-------|---------|--------|
| R1 | **`emailAccountsService` calls nonexistent `/api/email/accounts` endpoint** | `emailAccountsService.ts` | Multi-account feature completely broken. Settings "Accounts" tab will 404/error on every action |
| R2 | **`confidentialEmailService` calls nonexistent `/api/email/confidential` endpoint** | `confidentialEmailService.ts` | Confidential mode metadata never saves. User sees success toast from send, but confidential restrictions are not persisted |
| R3 | **`enhancedEmailService` queries nonexistent `emails` table** | `enhancedEmailService.ts` | Service is completely broken. Fortunately only used by dead `EnhancedEmailClient` - but still exported and importable |
| R4 | **No email pagination** | `PulseEmailClientRedesign.tsx` | Hard limit of 50 emails per folder. Users with >50 emails in a folder cannot access older messages |
| R5 | **Campaign sending is not implemented** | `emailCampaignService.ts` | Campaigns can be created, scheduled, and set to "sending" status, but no actual email dispatch occurs. Misleading UX |
| R6 | **Reply All / Forward not properly differentiated** | `PulseEmailClient[Redesign].tsx` | Both use the same `handleReply` - Reply All doesn't auto-fill CC, Forward doesn't add "Fwd:" prefix or clear "To" |
| R7 | **Gemini API key exposed in client** | `emailAIService.ts:51` | `import.meta.env.VITE_GEMINI_API_KEY` ships the key to the browser. Should proxy through backend |

### YELLOW - Medium (12)

| # | Issue | File(s) | Impact |
|---|-------|---------|--------|
| Y1 | **PulseEmailClientRedesign is a god component (~1,159 lines)** | `PulseEmailClientRedesign.tsx` | 30+ useState hooks, all email logic in one component. Hard to maintain/test |
| Y2 | **Massive code duplication between PulseEmailClient and PulseEmailClientRedesign** | Both files | ~80% identical logic (sync, offline, auth, compose, keyboard shortcuts). Only Redesign is active |
| Y3 | **No attachment download/preview** | `EmailViewerNew.tsx` | `has_attachments` flag shown but no UI to view, download, or preview attachments |
| Y4 | **Smart Compose service is a scaffold** | `smartComposeService.ts` | `getInlineSuggestion()` returns null always. Referenced in composer but no inline UI |
| Y5 | **Incremental sync uses date-based filter, not historyId** | `emailSyncService.ts` | Re-fetches emails from `lastSync - 1 day` every sync. Inefficient for frequent syncs |
| Y6 | **AI analysis not auto-triggered on new emails** | `emailSyncService.ts` | Emails cached but `ai_*` fields remain null until manually triggered in viewer |
| Y7 | **Follow-up detection has hardcoded 14-day window** | `FollowUpNudge.tsx` | Not configurable. No setting to adjust the follow-up window |
| Y8 | **`DailyBriefing.tsx:71` has `followUpCount = 0` with TODO comment** | `DailyBriefing.tsx` | Follow-up count always shows 0 in briefing despite FollowUpNudge working independently |
| Y9 | **Campaign analytics are all zeros (stub)** | `emailCampaignService.ts` | Stats fields (opened, clicked, bounced) exist but no tracking pixels/webhooks to populate them |
| Y10 | **Vacation responder doesn't call Gmail API** | `EmailSettingsModal.tsx` | Settings UI saves config locally but doesn't activate Gmail's vacation responder via API |
| Y11 | **Bulk operations have API routes but no client UI** | `src/pages/api/email/bulk.ts` | Routes for bulk mark-read/archive/trash exist but no multi-select checkbox UI |
| Y12 | **Two different `EmailFilter` interfaces** | `emailFilterService.ts` vs `FilterManager.tsx` | FilterManager defines its own filter shape with different field names than the service |

### GREEN - Nice-to-Have (10)

| # | Issue | File(s) | Impact |
|---|-------|---------|--------|
| G1 | **Dead code: `EmailLegacy.tsx` (699 lines)** | `src/components/EmailLegacy.tsx` | Not imported anywhere. Safe to delete |
| G2 | **Dead code: `EnhancedEmailClient.tsx` (451 lines)** | `src/components/Email/EnhancedEmailClient.tsx` | Exported from barrel but never consumed |
| G3 | **Dead code: `PulseEmailClient.tsx` (908 lines)** | `src/components/Email/PulseEmailClient.tsx` | Superseded by Redesign, still exported from barrel |
| G4 | **Dead legacy components: `EmailSidebar`, `EmailList`, `EmailViewer`, `EmailComposer`** | Various | Only used by dead parent components |
| G5 | **Orphaned DB tables: `scheduled_emails`, `snoozed_emails`** | Migration backup | Created in migration but never referenced in code |
| G6 | **No email body HTML rendering** | `EmailViewerNew.tsx` | Strips HTML tags for display. Rich HTML emails shown as plain text |
| G7 | **Offline compose not supported** | - | Can read cached emails offline but cannot queue outgoing emails |
| G8 | **No realtime push notifications from Gmail** | - | Currently polling-based only |
| G9 | **`useOfflineEmails` hook exists but isn't used** | `src/hooks/useOfflineEmails.ts` | 379 lines of hook code that nothing imports |
| G10 | **Test coverage extremely low** | `src/services/__tests__/` | Only 4 test files (~290 lines) for 18 services and 36 components |

---

## 5. Dead Code Summary

| File | Lines | Reason |
|------|-------|--------|
| `src/components/EmailLegacy.tsx` | 699 | Not imported anywhere |
| `src/components/Email/EnhancedEmailClient.tsx` | 451 | Exported but never consumed |
| `src/components/Email/PulseEmailClient.tsx` | 908 | Superseded by PulseEmailClientRedesign |
| `src/components/Email/EmailSidebar.tsx` | 130 | Only used by PulseEmailClient |
| `src/components/Email/EmailList.tsx` | 300 | Only used by PulseEmailClient |
| `src/components/Email/EmailViewer.tsx` | 222 | Only used by EnhancedEmailClient |
| `src/components/Email/EmailComposer.tsx` | 317 | Only used by EnhancedEmailClient |
| `src/services/enhancedEmailService.ts` | 453 | Uses nonexistent `emails` table, only used by dead EnhancedEmailClient |
| `src/hooks/useOfflineEmails.ts` | 379 | Not imported anywhere |
| **Total dead code** | **~3,859 lines** | |

---

## 6. Duplicate Logic

| Logic | Locations | Notes |
|-------|-----------|-------|
| Email load/sync/offline handling | `PulseEmailClient.tsx`, `PulseEmailClientRedesign.tsx` | ~80% identical, 400+ duplicated lines |
| Email filter type definitions | `emailFilterService.ts`, `FilterManager.tsx`, `types/email.ts` | Three different `EmailFilter` interfaces |
| Recipient parsing | `EmailComposerModal.tsx`, `EmailCampaignBuilder.tsx` | Both have `parseEmails()` / `parseRecipients()` |
| Avatar initials/colors | `EmailViewerNew.tsx`, `EmailListRedesign.tsx` | Same `getInitials()` + `getAvatarColor()` logic |
| Date formatting | `EmailViewerNew.tsx`, `EmailListRedesign.tsx`, `DailyBriefing.tsx` | Multiple relative time formatters |

---

## 7. Revisal Plan

### Phase 1: Fix Critical Issues (Priority)

1. **Create missing API routes** for `emailAccountsService` and `confidentialEmailService`
   - Add `src/pages/api/email/accounts.ts` with CRUD operations
   - Add `src/pages/api/email/confidential.ts` with create/revoke operations
   - Or: migrate these services to use Supabase directly (like other services do)

2. **Implement proper Reply All and Forward**
   - Reply All: auto-fill CC with all original recipients (minus current user)
   - Forward: clear To field, add "Fwd:" prefix, include original message as quote

3. **Add email pagination**
   - Implement cursor-based pagination in `emailSyncService.getEmailsByFolder()`
   - Add infinite scroll or "Load more" button to `EmailListRedesign`

4. **Move Gemini API key server-side**
   - Create `/api/ai/email-analyze` proxy endpoint
   - Route all Gemini calls through backend instead of exposing key in browser

5. **Fix or remove campaign sending**
   - Either implement actual bulk email dispatch (via Gmail batch API or Resend)
   - Or clearly mark campaigns as "Draft/Preview only" in UI

### Phase 2: Wire Up Partial/Stub Functionality

6. **Auto-trigger AI analysis on sync**
   - After caching emails in `fullSync()`, queue background AI analysis
   - Rate-limit Gemini calls (e.g., analyze top 10 unread per sync)

7. **Connect semantic search to main search UI**
   - `emailSearchService` has full semantic search but `PulseEmailClientRedesign` uses basic `emailSyncService.searchEmails()`

8. **Implement inline Smart Compose**
   - Wire `smartComposeService.getInlineSuggestion()` to composer textarea
   - Show ghost text suggestions as user types

9. **Connect vacation responder to Gmail API**
   - Use `gmailService` to call Gmail settings API for vacation auto-reply

10. **Add bulk selection UI**
    - Add checkbox column to `EmailListRedesign`
    - Wire to existing `/api/email/bulk` endpoints

11. **Fix DailyBriefing follow-up count**
    - Wire to same detection logic as `FollowUpNudge`

### Phase 3: Refactor & Clean Up

12. **Delete dead code** (~3,859 lines)
    - Remove `EmailLegacy.tsx`, `EnhancedEmailClient.tsx`, `PulseEmailClient.tsx`
    - Remove `EmailSidebar.tsx`, `EmailList.tsx`, `EmailViewer.tsx`, `EmailComposer.tsx`
    - Remove `enhancedEmailService.ts`, `useOfflineEmails.ts`
    - Clean barrel exports in `index.tsx`

13. **Break up PulseEmailClientRedesign god component**
    - Extract email state management into a Zustand store or context
    - Extract sync logic into a `useEmailSync` hook
    - Extract offline logic into existing (but unused) `useOfflineEmails` hook
    - Extract campaign view into standalone route/component

14. **Unify filter type definitions**
    - Single source of truth for `EmailFilter` in `emailFilterService.ts`
    - Update `FilterManager.tsx` to use service types

15. **Extract shared utilities**
    - `getInitials()`, `getAvatarColor()`, `formatRelativeTime()`, `parseEmails()`
    - Into `src/utils/emailUtils.ts`

16. **Use Gmail historyId for incremental sync**
    - Replace date-based re-fetch with proper Gmail History API

### Phase 4: New Features & Polish

17. **HTML email rendering** - Render `body_html` safely with iframe/shadow DOM
18. **Attachment preview/download** - Fetch attachment data via Gmail API, render inline
19. **Offline compose queue** - Store outgoing emails in IndexedDB, send on reconnect
20. **Gmail push notifications** - Set up pub/sub for real-time email arrival
21. **Campaign analytics** - Implement tracking pixels and click tracking
22. **Multi-account support** - Complete the accounts feature with proper API routes
23. **Unified inbox integration** - Wire the existing `UnifiedInbox` component into the email section

---

## 8. Claude Agent Prompt (Revisal Execution)

```
You are performing a phased revisal of the Pulse Email section based on a completed audit.

## Context

The Pulse Email section is an AI-powered email client built with React + TypeScript + Supabase + Gmail API + Gemini AI. The entry point is `src/components/Email/EmailClientWrapper.tsx` which renders `PulseEmailClientRedesign.tsx`.

## Current Architecture

- **Active client**: `PulseEmailClientRedesign.tsx` (~1,159 lines) - god component with 30+ useState hooks
- **Core services**: `emailSyncService.ts` (Gmail sync + Supabase cache), `gmailService.ts` (Gmail API), `emailAIService.ts` (Gemini)
- **Database**: `cached_emails` table is the primary store, `email_threads` for threading
- **Offline**: IndexedDB via `offlineEmailStorage.ts`
- **API routes**: `src/pages/api/email/` (signatures, labels, filters, bulk, search)

## Critical Issues to Fix (Phase 1)

### 1. Missing API Routes
- `src/services/emailAccountsService.ts` calls `/api/email/accounts` - NO ROUTE EXISTS
- `src/services/confidentialEmailService.ts` calls `/api/email/confidential` - NO ROUTE EXISTS
- **Fix**: Either create the API routes at `src/pages/api/email/accounts.ts` and `src/pages/api/email/confidential.ts`, OR migrate these services to use Supabase client directly (like `emailFilterService.ts` does)

### 2. Reply All / Forward Not Differentiated
- In `PulseEmailClientRedesign.tsx`, both Reply All and Forward use the same `handleReply()` handler
- **Fix**: Create separate `handleReplyAll()` that auto-fills CC, and `handleForward()` that clears To and adds "Fwd:" prefix

### 3. No Pagination
- `emailSyncService.getEmailsByFolder()` returns max 50 emails
- `EmailListRedesign.tsx` has no infinite scroll or "load more"
- **Fix**: Add offset/cursor parameters to `getEmailsByFolder()`, add infinite scroll to list component

### 4. Gemini API Key in Client Bundle
- `emailAIService.ts:51` reads `import.meta.env.VITE_GEMINI_API_KEY` - this ships to the browser
- **Fix**: Create `/api/ai/email` proxy endpoint, route all Gemini calls through it

### 5. Campaign Send is Fake
- `emailCampaignService.ts` changes campaign status but doesn't send emails
- **Fix**: Implement actual send using Gmail batch API or Resend, or mark feature as "Preview only"

## Dead Code to Remove (Phase 3)

Delete these files (total ~3,859 lines):
- `src/components/EmailLegacy.tsx` (699 lines) - not imported anywhere
- `src/components/Email/EnhancedEmailClient.tsx` (451 lines) - exported but never consumed
- `src/components/Email/PulseEmailClient.tsx` (908 lines) - superseded by Redesign
- `src/components/Email/EmailSidebar.tsx` (130 lines) - only used by deleted PulseEmailClient
- `src/components/Email/EmailList.tsx` (300 lines) - only used by deleted PulseEmailClient
- `src/components/Email/EmailViewer.tsx` (222 lines) - only used by deleted EnhancedEmailClient
- `src/components/Email/EmailComposer.tsx` (317 lines) - only used by deleted EnhancedEmailClient
- `src/services/enhancedEmailService.ts` (453 lines) - uses nonexistent `emails` table
- `src/hooks/useOfflineEmails.ts` (379 lines) - not imported anywhere

After deletion, update `src/components/Email/index.tsx` to remove dead exports.

## Refactoring (Phase 3)

### Break Up God Component
Extract from `PulseEmailClientRedesign.tsx`:
1. **Email state store** (Zustand): emails, selectedEmail, folders, counts, sync state
2. **`useEmailSync` hook**: sync logic, auto-sync timer, pending actions
3. **`useEmailCompose` hook**: composer state, send with undo, reply/forward logic
4. **Campaign view**: extract campaign dashboard/builder into route-level component

### Unify Types
Three different `EmailFilter` interfaces exist:
- `src/services/emailFilterService.ts` (canonical)
- `src/components/Email/FilterManager.tsx` (different field names)
- `src/types/email.ts` (yet another shape)
Consolidate to use `emailFilterService.ts` types everywhere.

## Key File Paths

- Entry: `src/components/Email/EmailClientWrapper.tsx`
- Main client: `src/components/Email/PulseEmailClientRedesign.tsx`
- Core service: `src/services/emailSyncService.ts`
- Gmail API: `src/services/gmailService.ts`
- AI service: `src/services/emailAIService.ts`
- Offline: `src/services/offlineEmailStorage.ts`
- API routes: `src/pages/api/email/`
- DB schema: `supabase/migrations_backup/005_email_cache.sql`
- Types: `src/types/email.ts`
```

---

*End of audit.*
