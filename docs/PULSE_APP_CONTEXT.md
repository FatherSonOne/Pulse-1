# Pulse App - Technical Specifications & Feature Context

## 1. Application Overview
Pulse is a real-time, AI-powered "War Room" dashboard designed for high-fidelity interactions. It combines voice/audio capabilities with text-based chat, deep reasoning ("Thinking" mode), and a document-based Knowledge Base (RAG).

## 2. Core Features

### 🧠 AI & Reasoning
- **Realtime Agent**: Voice and audio interaction capabilities (WebRTC/WebSocket).
- **Deep Thinking Mode**: A toggleable feature that enables "Chain of Thought" reasoning.
  - Logs internal reasoning steps to `ai_thinking_logs`.
  - Visible to users via expandable UI elements.
- **AI Summarization**: Generates concise summaries of sessions and uploaded documents using Gemini AI.

### 📚 Knowledge Base (RAG)
- **Document Ingestion**:
  - Supports text file uploads.
  - **Pipeline**: Upload → Read → Embed → Store.
  - Generates **AI Summaries** and **Keywords** for every uploaded document.
- **Vector Search**:
  - Uses Supabase `doc_embeddings` for semantic search.
  - Retrieves relevant context for user queries.
- **Debug System**:
  - Comprehensive console logging with emoji markers (📤, 📄, ✅, 🚀) to track ingestion status.

### 💾 Session Management
- **Persistent History**: Conversations are saved to Supabase (`ai_sessions`, `ai_messages`).
- **Row Level Security (RLS)**: Strict data isolation ensuring users only access their own logs and documents.

### 📤 Export & Sharing
- **Export Formats**:
  - **Markdown (.md)**: Full conversation with timestamps and citations.
  - **JSON (.json)**: Structured data for external integrations.
  - **AI Summary**: Clipboard-ready text summary.
- **Share Actions**:
  - **Messages**: Formatted for instant messaging apps.
  - **Email**: Opens default mail client with session content.
  - **Integrations**: Ready for Voxer and Logos Vision connections.

### 🎨 UI/UX
- **Theme**: Adaptive Dark/Light mode (inherits from parent Pulse application context).
- **Live Dashboard**:
  - Audio controls.
  - Export modal.
  - Chat interface with "Thinking" expanders.

## 3. Technical Architecture

### Frontend
- **Framework**: React (Vite)
- **Language**: TypeScript
- **Key Components**: `LiveDashboard.tsx`

### Backend & Infrastructure
- **Platform**: Vercel
- **Database**: Supabase (PostgreSQL)
  - **Auth**: Supabase Auth
  - **Vector Store**: `pgvector` extension
- **API Integration**:
  - OpenAI Realtime API
  - Gemini AI (for summaries)

## 4. Data Schema

### Tables
| Table Name | Description | Key Columns |
|------------|-------------|-------------|
| `ai_sessions` | Conversation metadata | `id`, `user_id`, `created_at` |
| `ai_messages` | Chat history | `id`, `session_id`, `content`, `role` |
| `ai_thinking_logs` | Chain-of-thought logs | `id`, `message_id`, `content` |
| `doc_embeddings` | RAG Knowledge Base | `id`, `content`, `embedding`, `ai_summary`, `ai_keywords` |

### Security Policies
- **RLS**: Enabled on all tables.
- **Policy Example**: "Users can insert thinking logs for own messages" (ensures data integrity).

## 5. Development Context
- **Migrations**: SQL files located in `supabase/migrations` (e.g., `008_fix_thinking_logs_rls.sql`).
- **Environment**: Requires Vercel project linking (`.vercel` folder present).