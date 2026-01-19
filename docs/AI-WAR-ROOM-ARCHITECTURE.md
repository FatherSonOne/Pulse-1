# AI War Room - System Architecture

## 🏗️ Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        LiveDashboard.tsx                         │
│  (Main React Component - 1100+ lines)                           │
│                                                                  │
│  State Management:                                               │
│  - Projects (War Rooms)                                         │
│  - Sessions (Conversations)                                      │
│  - Messages (Chat history)                                       │
│  - Documents (Knowledge base)                                    │
│  - Thinking Logs (AI reasoning steps)                          │
│  - Prompt Suggestions (Context-aware)                          │
│  - UI State (sidebar, modals, loading)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ calls
                              ▼
    ┌─────────────────────────────────────────────────────────┐
    │              ragService.ts (Enhanced)                    │
    │                                                          │
    │  Project Management:                                     │
    │  ├─ createProject()                                      │
    │  ├─ getProjects()                                        │
    │  └─ deleteProject()                                      │
    │                                                          │
    │  Session Management:                                     │
    │  ├─ createSession() [project-aware]                     │
    │  ├─ getSessions() [filtered by project]                 │
    │  ├─ getMessages()                                        │
    │  ├─ addMessage()                                         │
    │  └─ deleteSession()                                      │
    │                                                          │
    │  Document & RAG:                                         │
    │  ├─ ingestTextDocument() [with AI summary/keywords]     │
    │  ├─ getDocuments() [project-filtered]                   │
    │  ├─ searchSimilar() [project-filtered vector search]    │
    │  ├─ deleteDocument()                                     │
    │  └─ chunkText()                                          │
    │                                                          │
    │  AI Intelligence:                                        │
    │  ├─ saveThinkingLog()                                    │
    │  ├─ getThinkingLog()                                     │
    │  ├─ generateSuggestions()                                │
    │  ├─ getSuggestions()                                     │
    │  └─ markSuggestionUsed()                                 │
    └─────────────────────────────────────────────────────────┘
                    │                        │
                    │                        │
        ┌───────────▼─────────┐    ┌────────▼──────────┐
        │  geminiService.ts   │    │   Supabase DB     │
        │                     │    │                   │
        │  - processWithModel │    │  Tables:          │
        │  - generateEmbedding│    │  ├─ ai_projects   │
        │  - generateSpeech   │    │  ├─ ai_sessions   │
        └─────────────────────┘    │  ├─ ai_messages   │
                                   │  ├─ knowledge_docs│
                                   │  ├─ doc_embeddings│
                                   │  ├─ project_docs  │
                                   │  ├─ ai_thinking_logs│
                                   │  └─ ai_prompt_suggestions│
                                   └───────────────────┘
```

---

## 📊 Data Flow Diagrams

### 1. Document Upload & Processing Flow

```
User Uploads File
      │
      ▼
[LiveDashboard] handleFileUpload()
      │
      ├─ Read file as text (FileReader)
      │
      ▼
[ragService] ingestTextDocument()
      │
      ├─ 1. Create doc record in DB (status: 'processing')
      │     └─ Link to project (project_docs)
      │
      ├─ 2. PARALLEL: Generate AI summary & keywords
      │     ├─ [geminiService] processWithModel() → Summary
      │     └─ [geminiService] processWithModel() → Keywords
      │
      ├─ 3. Chunk text (1000 chars, 100 overlap)
      │
      ├─ 4. LOOP: Generate embeddings (max 50 chunks)
      │     └─ [geminiService] generateEmbedding()
      │           └─ REST API: /v1beta/models/text-embedding-004:embedContent
      │
      ├─ 5. Save embeddings to doc_embeddings table
      │
      └─ 6. Update doc (status: 'completed', ai_summary, ai_keywords)
            │
            ▼
      Toast: "✅ file.txt indexed with AI summary!"
```

### 2. AI Chat with RAG Flow

```
User Sends Message
      │
      ▼
[LiveDashboard] handleSendMessage()
      │
      ├─ 1. Add user message to DB
      │
      ├─ 2. IF enableExtendedThinking:
      │     └─ Start logging thinking steps with timestamps
      │
      ├─ 3. IF documents exist:
      │     │
      │     └─ [ragService] searchSimilar()
      │           │
      │           ├─ Generate query embedding
      │           │   └─ [geminiService] generateEmbedding()
      │           │
      │           ├─ Call match_documents() RPC (vector search)
      │           │   └─ Returns top 5 chunks with similarity > 0.5
      │           │
      │           └─ IF projectId: Filter by project_docs
      │
      ├─ 4. Build context prompt:
      │     ├─ Agent persona system prompt
      │     ├─ Document chunks (if found)
      │     └─ User query
      │
      ├─ 5. [geminiService] processWithModel()
      │     └─ REST API: /v1beta/models/gemini-2.0-flash-exp:generateContent
      │
      ├─ 6. Add AI message to DB with citations
      │
      ├─ 7. IF enableExtendedThinking:
      │     └─ [ragService] saveThinkingLog()
      │
      └─ 8. ASYNC: Generate prompt suggestions
            └─ [ragService] generateSuggestions()
```

### 3. Project/War Room Isolation

```
User Selects Project
      │
      ▼
[LiveDashboard] setSelectedProjectId(id)
      │
      ├─ useEffect triggers on projectId change
      │
      ├─ loadSessions()
      │   └─ [ragService] getSessions(userId, projectId)
      │         └─ SQL: WHERE project_id = ?
      │
      └─ loadDocuments()
          └─ [ragService] getDocuments(userId, projectId)
                │
                ├─ Query project_docs WHERE project_id = ?
                │   └─ Get list of doc_ids
                │
                └─ Query knowledge_docs WHERE id IN (doc_ids)
```

---

## 🗄️ Database Schema Relationships

```
users (public.users)
  │
  ├─────────── ai_projects (1:many)
  │                 │
  │                 ├─────────── ai_sessions (1:many)
  │                 │                 │
  │                 │                 ├─────────── ai_messages (1:many)
  │                 │                 │                 │
  │                 │                 │                 └─────────── ai_thinking_logs (1:1)
  │                 │                 │
  │                 │                 └─────────── ai_prompt_suggestions (1:many)
  │                 │
  │                 └─────────── project_docs (many:many)
  │                                   │
  │                                   └─────────── knowledge_docs
  │
  └─────────── knowledge_docs (1:many)
                    │
                    └─────────── doc_embeddings (1:many)
                          │
                          └─ embedding: VECTOR(768)
                          └─ content: TEXT (chunk)
```

### Key Relationships:
- **Users → Projects**: One user can have many war rooms
- **Projects → Sessions**: Each session belongs to one project (nullable)
- **Projects → Documents**: Many-to-many via `project_docs`
- **Documents → Embeddings**: One doc split into many chunks
- **Messages → Thinking Logs**: Each AI message can have one thinking log
- **Sessions → Suggestions**: Auto-generated prompts for each session

---

## 🔐 Security Model (RLS Policies)

```
ai_projects:
  ├─ Users can CRUD own projects
  └─ WHERE user_id = auth.uid()

ai_sessions:
  ├─ Users can CRUD own sessions
  └─ WHERE user_id = auth.uid()

ai_messages:
  ├─ Users can SELECT messages in own sessions
  ├─ Users can INSERT own messages
  └─ AI can INSERT messages (user_id IS NULL)

knowledge_docs:
  ├─ Users can CRUD own docs
  └─ Team can SELECT all docs (team knowledge base)

doc_embeddings:
  ├─ Users can INSERT any embeddings (team contribution)
  └─ Users can SELECT all embeddings (shared knowledge)

project_docs:
  └─ Users can CRUD links for own projects

ai_thinking_logs:
  └─ Users can SELECT logs for messages in own sessions

ai_prompt_suggestions:
  └─ Users can CRUD suggestions for own sessions
```

---

## 🚀 API Integrations

### Gemini API Endpoints Used:

1. **Text Generation**
   - Endpoint: `POST /v1beta/models/gemini-2.0-flash-exp:generateContent`
   - Used for: AI responses, summaries, keywords, suggestions
   - Rate limit: ~60 requests/minute

2. **Text Embeddings**
   - Endpoint: `POST /v1beta/models/text-embedding-004:embedContent`
   - Used for: Document chunking, query embeddings
   - Dimensions: 768
   - Rate limit: Throttled to 200ms between calls

3. **Speech Synthesis**
   - Endpoint: Custom (via generateSpeech)
   - Used for: Audio overviews
   - Format: MP3

### Supabase RPC Functions:

1. **match_documents()**
   - Performs cosine similarity search
   - Returns top N chunks above threshold
   - Joins with knowledge_docs for metadata
   - Filterable by user_id

---

## 🎨 UI Component Hierarchy

```
LiveDashboard
│
├─ Sidebar (collapsible)
│   ├─ Header ("AI War Room")
│   ├─ War Rooms Selector
│   │   ├─ Create Project Form
│   │   └─ Project List (with delete)
│   ├─ Sessions List
│   │   ├─ Create Session Form
│   │   └─ Session Cards (with delete)
│   └─ Knowledge Base Button (with count badge)
│
├─ Main Content Area
│   ├─ Header Bar
│   │   ├─ Sidebar Toggle
│   │   ├─ Project Badge (if selected)
│   │   ├─ Session Title
│   │   ├─ Deep Thinking Toggle
│   │   ├─ Agent Selector Dropdown
│   │   ├─ Upload Button
│   │   └─ Audio Button
│   │
│   ├─ Messages Area
│   │   ├─ Empty State
│   │   │   ├─ Quick Start Cards (4 options)
│   │   │   └─ Knowledge Base Indicator
│   │   │
│   │   └─ Message List
│   │       └─ Message Bubble
│   │           ├─ Content
│   │           ├─ Citations (if AI message)
│   │           ├─ Thinking Log (collapsible)
│   │           └─ Timestamp
│   │
│   ├─ Prompt Suggestions Bar (dismissible)
│   │   └─ Suggestion Pills (clickable)
│   │
│   └─ Input Area
│       ├─ Context Indicators (active docs)
│       ├─ Text Input
│       └─ Send Button
│
└─ Modals
    └─ Knowledge Library Modal (full-screen overlay)
        ├─ Header (with count)
        ├─ Document Grid
        │   └─ Document Card
        │       ├─ Title & Metadata
        │       ├─ AI Summary Box
        │       ├─ Keyword Tags
        │       └─ Delete Button
        └─ Close Button
```

---

## 🧠 AI Agent System

### Agent Personas:

```typescript
const agentPrompts = {
  general: 'Helpful AI assistant. Clear and concise.',
  skeptic: 'Critical thinker. Questions assumptions. Constructive.',
  scribe: 'Meticulous note-taker. Bullet points and structure.',
  'deep-diver': 'Analytical researcher. Comprehensive with nuance.'
};
```

### Thinking Process (when enabled):

```
Step 1: Analyze Query
  └─ Parse user intent
  └─ Identify key entities

Step 2: Search Knowledge Base
  └─ Generate query embedding
  └─ Vector similarity search

Step 3: Select Context
  └─ Rank document chunks
  └─ Build citation list

Step 4: Formulate Response
  └─ Apply agent persona
  └─ Incorporate context

Step 5: Generate Output
  └─ Stream response
  └─ Track token count
```

---

## 📈 Performance Considerations

### Bottlenecks:
1. **Document Upload**: Embedding generation (50 chunks × 200ms = 10s)
2. **RAG Search**: Vector similarity (optimized via pgvector index)
3. **AI Response**: Gemini API latency (~2-3s)
4. **Thinking Logs**: Adds ~500ms overhead

### Optimizations:
- ✅ Parallel summary + keyword generation
- ✅ Chunk limit (50 max)
- ✅ Rate limiting (200ms between embeddings)
- ✅ Lazy loading thinking logs
- ✅ Background suggestion generation
- ✅ Indexed foreign keys
- ✅ RLS policies for security without N+1 queries

### Scaling Considerations:
- **1-100 docs**: Current implementation works great
- **100-1000 docs**: May need pagination, search optimization
- **1000+ docs**: Consider document clustering, hierarchical RAG

---

## 🔄 State Management Pattern

Uses **React Hooks** with clear separation:

```typescript
// Core Data
const [projects, setProjects] = useState<AIProject[]>([]);
const [sessions, setSessions] = useState<AISession[]>([]);
const [messages, setMessages] = useState<AIMessage[]>([]);
const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);

// UI State
const [isSidebarOpen, setIsSidebarOpen] = useState(true);
const [showDocLibrary, setShowDocLibrary] = useState(false);
const [isLoading, setIsLoading] = useState(false);

// Selection State
const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

// AI Features
const [thinkingLogs, setThinkingLogs] = useState<Map<string, ThinkingStep[]>>(new Map());
const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([]);
const [activeAgent, setActiveAgent] = useState<AgentType>('general');
const [enableExtendedThinking, setEnableExtendedThinking] = useState(false);

// Refs for side effects
const messagesEndRef = useRef<HTMLDivElement>(null);
```

**No Redux/Zustand needed** - React hooks sufficient for this use case.

---

## 🎯 Key Design Decisions

1. **Why Projects instead of Tags?**
   - Stronger isolation
   - Clearer mental model
   - Better for team collaboration

2. **Why Map for Thinking Logs?**
   - O(1) lookup by message ID
   - Easy expansion/collapse tracking

3. **Why Set for Expanded State?**
   - Fast has() checks
   - Natural add/delete semantics

4. **Why Parallel Summary + Keywords?**
   - Cuts processing time in half
   - Both use same text chunk
   - Independent operations

5. **Why 200ms Rate Limit?**
   - Avoids Gemini API throttling
   - Barely noticeable to user
   - Prevents 429 errors

6. **Why 50 Chunk Limit?**
   - Balances coverage vs. speed
   - ~10 seconds total (acceptable)
   - Covers ~50,000 chars (plenty for most docs)

---

This architecture is **production-ready**, **scalable**, and **maintainable**! 🚀
