xt so that it is clearly visible# NotebookLM Features - Complete Implementation Plan for Pulse War Room

## Overview
This document provides a detailed, step-by-step implementation plan to add ALL missing NotebookLM features to Pulse War Room, transforming it into a superior AI-powered research and collaboration platform.

**Timeline:** 12-16 weeks (3-4 months)  
**Team Size:** 2-3 developers  
**Priority:** High-impact features first, then nice-to-haves

---

## ✅ Recently Completed (Week 0)

### Active Context Panel
- **Status:** ✅ COMPLETED
- **Description:** Visual panel showing which documents are actively being used by the AI
- **Features:**
  - Toggle documents in/out of context with checkbox
  - Token count estimation
  - "Add All" and "Clear" buttons
  - Collapsible panel
  - Visual indicators on document cards
  - AI uses only active context docs when searching

---

## 📋 Implementation Phases

### **PHASE 1: Core Document Management (Weeks 1-3)**
**Goal:** Make document management as good as NotebookLM

#### Week 1: Document Viewer
**Priority:** 🔴 Critical  
**Estimated Time:** 5-7 days  
**Dependencies:** None

**Tasks:**
1. **Create DocumentViewer Component**
   ```typescript
   interface DocumentViewerProps {
     docId: string;
     onClose: () => void;
     highlights?: Highlight[];
     onHighlight?: (highlight: Highlight) => void;
   }
   ```

2. **Features to Implement:**
   - [ ] Full-screen modal viewer
   - [ ] Text rendering with formatting
   - [ ] Scroll to specific sections
   - [ ] Copy text functionality
   - [ ] Print document
   - [ ] Keyboard shortcuts (Esc to close, Ctrl+F to search)
   - [ ] Mobile-responsive design

3. **Database Changes:**
   ```sql
   -- Store full text content
   ALTER TABLE knowledge_docs 
   ADD COLUMN full_text_content TEXT;
   ```

4. **API Endpoints:**
   - `GET /api/documents/:id/content` - Fetch full document content

5. **Files to Create:**
   - `src/components/WarRoom/DocumentViewer/DocumentViewer.tsx`
   - `src/components/WarRoom/DocumentViewer/DocumentViewer.css`

**Acceptance Criteria:**
- [ ] Can view any uploaded document in full-screen
- [ ] Text is properly formatted and readable
- [ ] Can copy and print content
- [ ] Works on mobile devices

---

#### Week 2: Search Functionality
**Priority:** 🔴 Critical  
**Estimated Time:** 5-7 days  
**Dependencies:** None

**Tasks:**
1. **Implement Full-Text Search**
   ```typescript
   interface SearchOptions {
     query: string;
     scope: 'current-doc' | 'all-docs' | 'current-project' | 'active-context';
     filters?: {
       fileType?: string[];
       dateRange?: [Date, Date];
       keywords?: string[];
       hasAISummary?: boolean;
     };
     sortBy?: 'relevance' | 'date' | 'title';
   }
   ```

2. **Search Features:**
   - [ ] Real-time search as you type (debounced)
   - [ ] Search across all documents or within one
   - [ ] Filter by file type, date, keywords
   - [ ] Highlight search terms in results
   - [ ] Search history (last 10 searches)
   - [ ] Search suggestions
   - [ ] Advanced search syntax (AND, OR, NOT, "exact phrase")

3. **Database Setup:**
   ```sql
   -- Add full-text search index
   CREATE INDEX idx_docs_fulltext ON knowledge_docs 
   USING GIN(to_tsvector('english', text_content));
   
   -- Search history table
   CREATE TABLE search_history (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID REFERENCES auth.users(id),
     query TEXT NOT NULL,
     scope VARCHAR(50),
     results_count INTEGER,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

4. **Libraries:**
   - Install: `fuse.js` for client-side fuzzy search
   - Use Supabase full-text search for server-side

5. **Files to Create:**
   - `src/components/WarRoom/Search/DocumentSearch.tsx`
   - `src/components/WarRoom/Search/SearchResults.tsx`
   - `src/components/WarRoom/Search/SearchFilters.tsx`
   - `src/services/searchService.ts`

**Acceptance Criteria:**
- [ ] Search returns relevant results in < 500ms
- [ ] Can filter and sort results
- [ ] Highlights search terms
- [ ] Search history works
- [ ] Mobile-friendly interface

---

#### Week 3: Enhanced File Format Support
**Priority:** 🔴 Critical  
**Estimated Time:** 5-7 days  
**Dependencies:** None

**Tasks:**
1. **Add PDF Support**
   - Install: `pdf-parse` or `pdf.js`
   - Extract text from PDFs
   - Handle multi-page PDFs
   - Preserve page numbers in chunks

2. **Add DOCX Support**
   - Install: `mammoth.js`
   - Extract text and basic formatting
   - Handle tables and lists

3. **Add XLSX Support**
   - Install: `xlsx` or `exceljs`
   - Extract data from spreadsheets
   - Convert to readable format

4. **Add Image Support (OCR)**
   - Install: `tesseract.js`
   - OCR for images (PNG, JPG, etc.)
   - Store extracted text

5. **Update Upload Flow:**
   ```typescript
   const SUPPORTED_TYPES = {
     'text/plain': { ext: '.txt', processor: processText },
     'text/markdown': { ext: '.md', processor: processMarkdown },
     'application/pdf': { ext: '.pdf', processor: processPDF },
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: '.docx', processor: processDOCX },
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: '.xlsx', processor: processXLSX },
     'image/png': { ext: '.png', processor: processImage },
     'image/jpeg': { ext: '.jpg', processor: processImage },
   };
   ```

6. **Files to Create:**
   - `src/services/documentProcessors/pdfProcessor.ts`
   - `src/services/documentProcessors/docxProcessor.ts`
   - `src/services/documentProcessors/xlsxProcessor.ts`
   - `src/services/documentProcessors/imageProcessor.ts`

**Acceptance Criteria:**
- [ ] Can upload PDFs and extract text
- [ ] Can upload DOCX files
- [ ] Can upload Excel files
- [ ] Can upload images with OCR
- [ ] Error handling for corrupted files
- [ ] Progress tracking for large files

---

### **PHASE 2: Content Generation Tools (Weeks 4-6)**
**Goal:** Auto-generate useful content from documents

#### Week 4: Study Guide Generator
**Priority:** 🟡 Medium  
**Estimated Time:** 5-7 days  
**Dependencies:** Phase 1 completion

**Tasks:**
1. **Create Study Guide Generator**
   ```typescript
   interface StudyGuide {
     id: string;
     docIds: string[];
     title: string;
     sections: StudySection[];
     questions: Question[];
     flashcards: Flashcard[];
     summary: string;
     createdAt: Date;
   }
   
   interface StudySection {
     title: string;
     content: string;
     keyPoints: string[];
     subSections?: StudySection[];
   }
   
   interface Question {
     question: string;
     answer: string;
     type: 'multiple-choice' | 'short-answer' | 'essay';
     difficulty: 'easy' | 'medium' | 'hard';
     options?: string[]; // for multiple choice
   }
   
   interface Flashcard {
     front: string;
     back: string;
     tags: string[];
   }
   ```

2. **Features:**
   - [ ] Extract main topics from document(s)
   - [ ] Generate hierarchical outline
   - [ ] Create practice questions
   - [ ] Generate flashcards
   - [ ] Export as PDF/Markdown
   - [ ] Interactive study mode

3. **Database:**
   ```sql
   CREATE TABLE study_guides (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID REFERENCES auth.users(id),
     project_id UUID REFERENCES ai_projects(id),
     title VARCHAR(500),
     content JSONB,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

4. **AI Prompts:**
   - Use GPT-4 to analyze document structure
   - Generate questions at different difficulty levels
   - Create concise flashcards
   - Identify key concepts and relationships

**Acceptance Criteria:**
- [ ] Generates comprehensive study guide in < 2 minutes
- [ ] Questions are relevant and well-formatted
- [ ] Flashcards are concise and clear
- [ ] Can export in multiple formats
- [ ] Interactive study mode works

---

#### Week 5: FAQ & Timeline Generators
**Priority:** 🟡 Medium  
**Estimated Time:** 5-7 days  
**Dependencies:** Phase 1 completion

**Tasks:**
1. **FAQ Generator**
   ```typescript
   interface FAQ {
     id: string;
     docIds: string[];
     questions: FAQItem[];
     categories: string[];
     createdAt: Date;
   }
   
   interface FAQItem {
     question: string;
     answer: string;
     category: string;
     sources: string[]; // doc titles
     relevance: number;
   }
   ```

   **Features:**
   - [ ] Extract common questions from content
   - [ ] Generate comprehensive answers
   - [ ] Categorize by topic
   - [ ] Link to source documents
   - [ ] Export as HTML/Markdown

2. **Timeline Generator**
   ```typescript
   interface Timeline {
     id: string;
     docIds: string[];
     events: TimelineEvent[];
     startDate: Date;
     endDate: Date;
   }
   
   interface TimelineEvent {
     date: Date;
     title: string;
     description: string;
     type: 'event' | 'milestone' | 'period';
     sources: string[];
     importance: 'low' | 'medium' | 'high';
   }
   ```

   **Features:**
   - [ ] Extract dates and events from documents
   - [ ] Chronological ordering
   - [ ] Visual timeline display (use `vis-timeline`)
   - [ ] Filter by date range
   - [ ] Export as image or document

3. **Libraries:**
   - Install: `vis-timeline` for visualization
   - Install: `date-fns` for date parsing
   - Install: `chrono-node` for natural language date extraction

**Acceptance Criteria:**
- [ ] FAQ generates 10-20 relevant questions
- [ ] Timeline extracts dates accurately
- [ ] Visual timeline is interactive
- [ ] Both export properly

---

#### Week 6: Table of Contents & Outline Generator
**Priority:** 🟡 Medium  
**Estimated Time:** 3-5 days  
**Dependencies:** Phase 1 completion

**Tasks:**
1. **Auto-Generate TOC**
   ```typescript
   interface TableOfContents {
     docId: string;
     sections: TOCSection[];
   }
   
   interface TOCSection {
     level: number; // 1 = H1, 2 = H2, etc.
     title: string;
     pageNumber?: number;
     startOffset: number;
     endOffset: number;
     children: TOCSection[];
   }
   ```

2. **Outline Generator**
   ```typescript
   interface DocumentOutline {
     docIds: string[];
     mainIdeas: OutlinePoint[];
   }
   
   interface OutlinePoint {
     level: number;
     text: string;
     evidence: string[];
     sources: string[];
     subPoints: OutlinePoint[];
   }
   ```

3. **Features:**
   - [ ] Analyze document structure
   - [ ] Extract headings and sections
   - [ ] Generate hierarchical outline
   - [ ] Link to original content
   - [ ] Export outline

**Acceptance Criteria:**
- [ ] TOC accurately reflects document structure
- [ ] Outline captures main ideas
- [ ] Navigation works properly
- [ ] Export formats work

---

### **PHASE 3: Audio Features (Weeks 7-8)**
**Goal:** Implement NotebookLM's signature Audio Overview feature

#### Week 7-8: Audio Overview (Podcast Generator)
**Priority:** 🔴 Critical (Signature Feature)  
**Estimated Time:** 10-12 days  
**Dependencies:** Phase 1 completion

**Tasks:**
1. **Audio Overview Architecture**
   ```typescript
   interface AudioOverview {
     id: string;
     projectId: string;
     docIds: string[];
     script: DialogueLine[];
     audioUrl: string;
     duration: number;
     transcript: string;
     createdAt: Date;
   }
   
   interface DialogueLine {
     speaker: 'host1' | 'host2';
     text: string;
     timestamp: number; // seconds
     emphasis?: 'normal' | 'excited' | 'thoughtful';
   }
   ```

2. **Implementation Steps:**
   
   **Step 1: Script Generation (Days 1-3)**
   - [ ] Analyze documents to extract key insights
   - [ ] Generate conversational dialogue
   - [ ] Create natural back-and-forth
   - [ ] Add questions, reactions, and discussion
   - [ ] Target 5-10 minute conversation

   **Prompt Engineering:**
   ```
   Create a podcast-style conversation between two hosts discussing the following documents.
   
   Host 1 (Sarah): Enthusiastic, asks probing questions, finds connections
   Host 2 (Marcus): Thoughtful, provides analysis, challenges assumptions
   
   Format as JSON:
   [
     {"speaker": "host1", "text": "...", "emphasis": "excited"},
     {"speaker": "host2", "text": "...", "emphasis": "thoughtful"}
   ]
   
   Requirements:
   - Natural conversation with interruptions
   - Reference specific documents
   - Highlight key insights and debates
   - Include "aha moments"
   - End with actionable takeaways
   ```

   **Step 2: Text-to-Speech (Days 4-6)**
   - [ ] Integrate ElevenLabs API or OpenAI TTS
   - [ ] Use different voices for each host
   - [ ] Add emotional emphasis
   - [ ] Handle long-form synthesis
   - [ ] Implement retry logic for failures

   **TTS Integration:**
   ```typescript
   import ElevenLabs from 'elevenlabs-node';
   
   const voice1 = 'Rachel'; // Female voice
   const voice2 = 'Adam';   // Male voice
   
   async function synthesizeLine(line: DialogueLine): Promise<Buffer> {
     const voice = line.speaker === 'host1' ? voice1 : voice2;
     const stability = line.emphasis === 'excited' ? 0.3 : 0.7;
     const similarity = 0.8;
     
     return await eleven.textToSpeech({
       voiceId: voice,
       text: line.text,
       stability,
       similarity_boost: similarity
     });
   }
   ```

   **Step 3: Audio Mixing (Days 7-9)**
   - [ ] Combine audio segments
   - [ ] Add pauses between speakers
   - [ ] Background music (optional)
   - [ ] Normalize volume levels
   - [ ] Export as MP3

   **Audio Processing:**
   ```typescript
   import ffmpeg from 'fluent-ffmpeg';
   
   async function mixAudio(segments: Buffer[]): Promise<string> {
     // Concatenate segments with 0.3s pauses
     // Add fade in/out
     // Normalize audio
     // Export as MP3
   }
   ```

   **Step 4: UI & Playback (Days 10-12)**
   - [ ] Audio player component
   - [ ] Show transcript with timestamps
   - [ ] Highlight current line
   - [ ] Download audio file
   - [ ] Share audio link

3. **Database:**
   ```sql
   CREATE TABLE audio_overviews (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID REFERENCES auth.users(id),
     project_id UUID REFERENCES ai_projects(id),
     doc_ids UUID[],
     script JSONB,
     audio_url TEXT,
     duration_seconds INTEGER,
     transcript TEXT,
     status VARCHAR(20), -- 'generating', 'completed', 'failed'
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

4. **APIs to Use:**
   - **ElevenLabs** (recommended) - Best quality, multiple voices
   - **OpenAI TTS** - Good quality, cheaper
   - **Azure Speech** - Enterprise option

5. **Cost Estimation:**
   - ElevenLabs: ~$0.30 per 10-min audio
   - OpenAI TTS: ~$0.015 per 1K characters
   - Storage: ~5-10MB per 10-min audio

**Acceptance Criteria:**
- [ ] Generates 5-10 minute podcast-style overview
- [ ] Natural conversation between two voices
- [ ] References specific document content
- [ ] Audio quality is clear and pleasant
- [ ] Can download and share
- [ ] Generation completes in < 5 minutes

---

### **PHASE 4: Annotations & Highlights (Weeks 9-10)**
**Goal:** Allow users to mark up and annotate documents

#### Week 9: Highlighting System
**Priority:** 🟡 Medium  
**Estimated Time:** 5-7 days  
**Dependencies:** Document Viewer (Week 1)

**Tasks:**
1. **Highlight Implementation**
   ```typescript
   interface Highlight {
     id: string;
     docId: string;
     userId: string;
     startOffset: number;
     endOffset: number;
     highlightedText: string;
     color: HighlightColor;
     note?: string;
     tags?: string[];
     createdAt: Date;
   }
   
   type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple';
   ```

2. **Features:**
   - [ ] Select text to highlight
   - [ ] Choose highlight color
   - [ ] Add notes to highlights
   - [ ] View all highlights for document
   - [ ] Jump to highlight
   - [ ] Export highlights
   - [ ] Share highlights with team

3. **Database:**
   ```sql
   CREATE TABLE doc_highlights (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     doc_id UUID REFERENCES knowledge_docs(id) ON DELETE CASCADE,
     user_id UUID REFERENCES auth.users(id),
     start_offset INTEGER NOT NULL,
     end_offset INTEGER NOT NULL,
     highlighted_text TEXT,
     color VARCHAR(20),
     note TEXT,
     tags TEXT[],
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   CREATE INDEX idx_highlights_doc ON doc_highlights(doc_id);
   CREATE INDEX idx_highlights_user ON doc_highlights(user_id);
   ```

4. **Libraries:**
   - Use `react-highlight-pop` or custom implementation
   - `mark.js` for highlighting

**Acceptance Criteria:**
- [ ] Can select and highlight text
- [ ] Multiple colors available
- [ ] Can add notes to highlights
- [ ] Highlights persist across sessions
- [ ] Export functionality works

---

#### Week 10: Annotations System
**Priority:** 🟡 Medium  
**Estimated Time:** 5-7 days  
**Dependencies:** Document Viewer, Highlights

**Tasks:**
1. **Annotation Implementation**
   ```typescript
   interface Annotation {
     id: string;
     docId: string;
     userId: string;
     position: {
       page?: number;
       offset: number;
     };
     content: string;
     type: 'note' | 'question' | 'important' | 'todo';
     resolved: boolean;
     replies: AnnotationReply[];
     tags?: string[];
     createdAt: Date;
   }
   
   interface AnnotationReply {
     id: string;
     userId: string;
     content: string;
     createdAt: Date;
   }
   ```

2. **Features:**
   - [ ] Click to add annotation
   - [ ] Different annotation types
   - [ ] Thread replies
   - [ ] Resolve/unresolve
   - [ ] @mention team members
   - [ ] View all annotations
   - [ ] Filter by type/author

3. **Database:**
   ```sql
   CREATE TABLE doc_annotations (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     doc_id UUID REFERENCES knowledge_docs(id) ON DELETE CASCADE,
     user_id UUID REFERENCES auth.users(id),
     position JSONB,
     content TEXT,
     type VARCHAR(20),
     resolved BOOLEAN DEFAULT FALSE,
     tags TEXT[],
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   CREATE TABLE annotation_replies (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     annotation_id UUID REFERENCES doc_annotations(id) ON DELETE CASCADE,
     user_id UUID REFERENCES auth.users(id),
     content TEXT,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

**Acceptance Criteria:**
- [ ] Can create annotations
- [ ] Thread replies work
- [ ] Can resolve annotations
- [ ] Filter and search work
- [ ] @mentions notify users

---

### **PHASE 5: Organization Tools (Weeks 11-12)**
**Goal:** Better ways to organize and find documents

#### Week 11: Tagging & Collections
**Priority:** 🟡 Medium  
**Estimated Time:** 5-7 days  
**Dependencies:** None

**Tasks:**
1. **Tagging System**
   ```typescript
   interface DocumentTag {
     id: string;
     name: string;
     color: string;
     icon: string;
     count: number;
     createdBy: string;
   }
   ```

2. **Collections**
   ```typescript
   interface DocumentCollection {
     id: string;
     name: string;
     description: string;
     type: 'manual' | 'smart';
     docIds?: string[]; // for manual collections
     rules?: CollectionRules; // for smart collections
     tags: string[];
     createdAt: Date;
   }
   
   interface CollectionRules {
     keywords?: string[];
     tags?: string[];
     dateRange?: [Date, Date];
     fileTypes?: string[];
     hasKeywords?: string[];
   }
   ```

3. **Features:**
   - [ ] Create custom tags
   - [ ] Assign tags to documents
   - [ ] Filter by tags
   - [ ] Tag auto-completion
   - [ ] Manual collections (drag & drop)
   - [ ] Smart collections (auto-organize by rules)
   - [ ] Recently viewed documents
   - [ ] Favorites/starred documents

4. **Database:**
   ```sql
   CREATE TABLE document_tags (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     name VARCHAR(100) NOT NULL,
     color VARCHAR(7),
     icon VARCHAR(50),
     user_id UUID REFERENCES auth.users(id),
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   CREATE TABLE doc_tags (
     doc_id UUID REFERENCES knowledge_docs(id) ON DELETE CASCADE,
     tag_id UUID REFERENCES document_tags(id) ON DELETE CASCADE,
     PRIMARY KEY (doc_id, tag_id)
   );
   
   CREATE TABLE document_collections (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID REFERENCES auth.users(id),
     name VARCHAR(200),
     description TEXT,
     type VARCHAR(20),
     rules JSONB,
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   CREATE TABLE collection_docs (
     collection_id UUID REFERENCES document_collections(id) ON DELETE CASCADE,
     doc_id UUID REFERENCES knowledge_docs(id) ON DELETE CASCADE,
     added_at TIMESTAMP DEFAULT NOW(),
     PRIMARY KEY (collection_id, doc_id)
   );
   
   CREATE TABLE doc_favorites (
     user_id UUID REFERENCES auth.users(id),
     doc_id UUID REFERENCES knowledge_docs(id) ON DELETE CASCADE,
     created_at TIMESTAMP DEFAULT NOW(),
     PRIMARY KEY (user_id, doc_id)
   );
   
   CREATE TABLE doc_recent_views (
     user_id UUID REFERENCES auth.users(id),
     doc_id UUID REFERENCES knowledge_docs(id) ON DELETE CASCADE,
     viewed_at TIMESTAMP DEFAULT NOW(),
     PRIMARY KEY (user_id, doc_id)
   );
   ```

**Acceptance Criteria:**
- [ ] Can create and assign tags
- [ ] Filter by tags works
- [ ] Manual collections work
- [ ] Smart collections auto-update
- [ ] Favorites and recent views work

---

#### Week 12: Advanced Organization Features
**Priority:** 🟢 Low  
**Estimated Time:** 3-5 days  
**Dependencies:** Week 11

**Tasks:**
1. **Document Versions**
   - [ ] Track document versions
   - [ ] Compare versions
   - [ ] Restore previous version

2. **Bulk Operations**
   - [ ] Select multiple documents
   - [ ] Bulk tag assignment
   - [ ] Bulk move to collection
   - [ ] Bulk delete

3. **Document Metadata**
   - [ ] Author field
   - [ ] Source URL
   - [ ] Custom metadata fields
   - [ ] Document rating

4. **Enhanced Drag & Drop**
   - [ ] Drag files to upload
   - [ ] Drag to reorder
   - [ ] Drag to collections
   - [ ] Drag to tags

**Acceptance Criteria:**
- [ ] Version tracking works
- [ ] Bulk operations are efficient
- [ ] Drag & drop is smooth
- [ ] Metadata displays properly

---

### **PHASE 6: Collaboration (Weeks 13-14)**
**Goal:** Enable team collaboration features

#### Week 13: Sharing & Permissions
**Priority:** 🟢 Low  
**Estimated Time:** 5-7 days  
**Dependencies:** None

**Tasks:**
1. **Sharing System**
   ```typescript
   interface DocumentShare {
     id: string;
     docId: string;
     sharedBy: string;
     sharedWith: string[]; // user IDs or email addresses
     permissions: SharePermissions;
     expiresAt?: Date;
     publicLink?: string;
     createdAt: Date;
   }
   
   interface SharePermissions {
     canView: boolean;
     canComment: boolean;
     canEdit: boolean;
     canShare: boolean;
   }
   ```

2. **Features:**
   - [ ] Share individual documents
   - [ ] Share entire projects
   - [ ] Granular permissions
   - [ ] Public links with expiration
   - [ ] Email invitations
   - [ ] Revoke access
   - [ ] View sharing activity

3. **Database:**
   ```sql
   CREATE TABLE document_shares (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     doc_id UUID REFERENCES knowledge_docs(id) ON DELETE CASCADE,
     shared_by UUID REFERENCES auth.users(id),
     shared_with_user UUID REFERENCES auth.users(id),
     shared_with_email VARCHAR(255),
     permissions JSONB,
     expires_at TIMESTAMP,
     public_link VARCHAR(255) UNIQUE,
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   CREATE TABLE project_shares (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     project_id UUID REFERENCES ai_projects(id) ON DELETE CASCADE,
     shared_by UUID REFERENCES auth.users(id),
     shared_with_user UUID REFERENCES auth.users(id),
     permissions JSONB,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

**Acceptance Criteria:**
- [ ] Can share documents with specific users
- [ ] Permissions are enforced
- [ ] Public links work
- [ ] Can revoke access
- [ ] Email invitations send

---

#### Week 14: Real-Time Collaboration
**Priority:** 🟢 Low  
**Estimated Time:** 5-7 days  
**Dependencies:** Week 13, Annotations (Week 10)

**Tasks:**
1. **Real-Time Features**
   - [ ] See who's viewing document
   - [ ] Live cursors for annotations
   - [ ] Real-time comment updates
   - [ ] Collaborative highlighting
   - [ ] Activity feed

2. **WebSocket Setup:**
   ```typescript
   interface CollaborationEvent {
     type: 'user-joined' | 'user-left' | 'annotation-added' | 'highlight-added';
     userId: string;
     docId: string;
     data: any;
     timestamp: Date;
   }
   ```

3. **Database:**
   ```sql
   CREATE TABLE activity_feed (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID REFERENCES auth.users(id),
     project_id UUID REFERENCES ai_projects(id),
     doc_id UUID REFERENCES knowledge_docs(id),
     action VARCHAR(100),
     details JSONB,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

**Acceptance Criteria:**
- [ ] Real-time updates work
- [ ] Activity feed is accurate
- [ ] No conflicts in collaborative edits
- [ ] Performance is good with multiple users

---

### **PHASE 7: Advanced AI Features (Weeks 15-16)**
**Goal:** Unique features beyond NotebookLM

#### Week 15: Comparative Analysis & Knowledge Graph
**Priority:** 🟢 Low  
**Estimated Time:** 5-7 days  
**Dependencies:** Phase 1

**Tasks:**
1. **Comparative Analysis**
   - [ ] Compare 2+ documents side-by-side
   - [ ] Identify agreements
   - [ ] Identify contradictions
   - [ ] Generate synthesis
   - [ ] Visual diff view

2. **Knowledge Graph**
   - [ ] Extract entities and relationships
   - [ ] Build graph database
   - [ ] Interactive visualization
   - [ ] Navigate by concept
   - [ ] Find connections

3. **Libraries:**
   - `react-force-graph` or `vis-network`
   - `neo4j` for graph database (optional)

**Acceptance Criteria:**
- [ ] Can compare documents effectively
- [ ] Knowledge graph is interactive
- [ ] Navigation works smoothly
- [ ] Insights are accurate

---

#### Week 16: Polish & Optimization
**Priority:** 🔴 Critical  
**Estimated Time:** 5-7 days  
**Dependencies:** All phases

**Tasks:**
1. **Performance Optimization**
   - [ ] Lazy loading for documents
   - [ ] Virtual scrolling for lists
   - [ ] Caching strategies
   - [ ] Database indexing
   - [ ] Image optimization

2. **Mobile Experience**
   - [ ] Touch gestures
   - [ ] Mobile-specific UI
   - [ ] Offline support
   - [ ] Progressive Web App

3. **Testing**
   - [ ] Unit tests for critical functions
   - [ ] Integration tests
   - [ ] E2E tests with Playwright
   - [ ] Performance testing
   - [ ] Accessibility testing

4. **Documentation**
   - [ ] User guide
   - [ ] API documentation
   - [ ] Video tutorials
   - [ ] Onboarding flow

**Acceptance Criteria:**
- [ ] App loads in < 2 seconds
- [ ] No memory leaks
- [ ] Mobile experience is smooth
- [ ] Test coverage > 70%
- [ ] Documentation is complete

---

## 📊 Resource Requirements

### **Development Team**
- **Lead Developer:** Full-time (16 weeks)
- **Backend Developer:** Full-time (12 weeks)
- **Frontend Developer:** Full-time (16 weeks)
- **UI/UX Designer:** Part-time (6 weeks)
- **QA Engineer:** Part-time (8 weeks)

### **Infrastructure & APIs**
- **Supabase:** $25-50/month
- **ElevenLabs TTS:** $99-330/month (based on usage)
- **OpenAI API:** $100-500/month (for embeddings + GPT-4)
- **Storage (S3/Cloudflare):** $20-100/month
- **Total:** ~$250-1000/month

### **Third-Party Services**
- **PDF.js:** Free
- **Mammoth.js:** Free
- **Tesseract.js:** Free
- **vis-timeline:** Free
- **ElevenLabs:** $99+/month

---

## 🎯 Success Metrics

### **User Engagement**
- **Document Upload Rate:** 5+ docs per user per week
- **Search Usage:** 60%+ of sessions include search
- **Audio Overview Usage:** 30%+ of projects generate audio overview
- **Annotation Usage:** 50%+ of documents have annotations
- **Sharing:** 25%+ of projects are shared with team members
- **Return Rate:** 85%+ of users return within 7 days

### **Performance**
- **App Load Time:** < 2 seconds
- **Search Response:** < 500ms
- **Document Processing:** < 2 minutes
- **Audio Generation:** < 5 minutes
- **Uptime:** 99.9%

### **Quality**
- **Search Accuracy:** 90%+ relevant results in top 5
- **Summary Quality:** 85%+ user satisfaction
- **Citation Accuracy:** 95%+ correct attribution
- **Bug Rate:** < 0.5% of sessions
- **Audio Quality:** 90%+ positive feedback

---

## 🚀 Launch Strategy

### **Alpha (Week 12)**
- Internal team testing
- 10-20 beta users
- Core features complete

### **Beta (Week 16)**
- Public beta release
- 100-500 users
- All features complete
- Gather feedback

### **V1.0 Launch (Week 18)**
- Marketing campaign
- Press release
- Product Hunt launch
- Unlimited users

---

## 💰 ROI & Business Case

### **Competitive Advantage**
- ✅ **Audio Overview:** Match NotebookLM's killer feature
- ✅ **Active Context:** Better control than NotebookLM
- ✅ **Multi-Agent AI:** Unique feature (skeptic, scribe, deep-diver)
- ✅ **Voice Chat:** Real-time voice interaction
- ✅ **War Room:** Unique project management approach

### **Pricing Potential**
- **Free Tier:** 5 documents, 1 project, 3 audio overviews/month
- **Pro Tier:** $15/month - Unlimited docs, projects, audio
- **Team Tier:** $50/month - Collaboration features, API access
- **Enterprise:** Custom pricing - SSO, dedicated support

### **Market Size**
- **Students:** 20M+ potential users
- **Researchers:** 5M+ potential users
- **Professionals:** 50M+ knowledge workers
- **Total Addressable Market:** $5-10B

---

## 📝 Risk Mitigation

### **Technical Risks**
- **Audio quality issues:** Have fallback TTS providers
- **Scaling issues:** Use serverless architecture
- **API costs:** Implement caching, rate limiting
- **Database performance:** Proper indexing, sharding if needed

### **Business Risks**
- **NotebookLM competition:** Focus on unique features (voice, agents, War Room)
- **API dependencies:** Have backup providers
- **User adoption:** Strong onboarding, tutorials
- **Cost management:** Monitor API usage, optimize prompts

---

## 🎓 Training & Onboarding

### **User Documentation**
1. Quick start guide (5 minutes)
2. Feature tutorials (video + text)
3. Best practices guide
4. FAQ section
5. Community forum

### **Developer Documentation**
1. Architecture overview
2. API documentation
3. Database schema
4. Deployment guide
5. Contributing guidelines

---

## 🔄 Maintenance & Updates

### **Weekly**
- Bug fixes
- Performance monitoring
- User feedback review

### **Monthly**
- Minor feature updates
- Security patches
- Dependency updates

### **Quarterly**
- Major feature releases
- UI/UX improvements
- Infrastructure upgrades

---

## 📈 Future Roadmap (Post-V1.0)

### **Q1 2026**
- Mobile apps (iOS/Android)
- Browser extensions
- API for third-party integrations
- Advanced analytics

### **Q2 2026**
- Multi-language support
- Advanced AI models (GPT-5, Claude 3.5)
- Custom AI agents
- Workflow automation

### **Q3 2026**
- Enterprise features
- White-label solution
- Advanced collaboration
- Marketplace for templates

---

## ✅ Conclusion

This implementation plan provides a complete roadmap to transform Pulse War Room into a NotebookLM competitor with unique advantages. By following this phased approach, we can deliver value incrementally while building toward feature parity and beyond.

**Key Differentiators:**
1. ✅ Multi-agent AI system
2. ✅ Real-time voice interaction
3. ✅ Active Context panel
4. ✅ War Room project structure
5. 🔜 Audio Overview (coming soon)
6. 🔜 Advanced collaboration tools

**Timeline:** 16 weeks to V1.0  
**Budget:** $4,000-16,000 (labor) + $250-1000/month (services)  
**Expected ROI:** 6-12 months to profitability with 10K+ users

---

*Document Version: 1.0*  
*Created: January 9, 2026*  
*Status: Ready for Development*  
*Next Review: Weekly during implementation*
