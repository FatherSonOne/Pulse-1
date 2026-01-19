import { supabase } from './supabase';
import { generateEmbedding, processWithModel } from './geminiService';
import { withFormattedOutput, getContextualFormattingHints } from './aiFormattingService';

export interface KnowledgeDoc {
  id: string;
  title: string;
  file_type: string;
  url?: string;
  created_at: string;
  summary?: string;
  ai_summary?: string;
  ai_keywords?: string[];
  processing_status?: string;
}

export interface AISession {
  id: string;
  title: string;
  description?: string;
  updated_at: string;
  session_type: string;
  project_id?: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  citations?: any[];
}

export interface AIProject {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  created_at: string;
}

export interface ThinkingStep {
  step: number;
  thought: string;
  duration_ms: number;
}

export interface PromptSuggestion {
  id: string;
  suggestion_text: string;
  context_summary: string;
  relevance_score: number;
}

export const ragService = {
  // 1. Ingest Text with AI Summary & Keywords
  async ingestTextDocument(
    apiKey: string, 
    userId: string, 
    title: string, 
    text: string, 
    type: 'text' | 'url' = 'text', 
    url?: string, 
    projectId?: string,
    onProgress?: (progress: number) => void
  ) {
    // 1. Create Doc Record
    onProgress?.(0.05); // 5%
    
    const { data: doc, error: docError } = await supabase
      .from('knowledge_docs')
      .insert({
        user_id: userId,
        title,
        file_type: type,
        url,
        text_content: text.substring(0, 100000),
        is_processed: false,
        processing_status: 'processing'
      })
      .select()
      .single();

    if (docError || !doc) throw docError || new Error('Failed to create doc');

    try {
      onProgress?.(0.10); // 10%

      // Link to project if provided
      if (projectId) {
        await supabase.from('project_docs').insert({
          project_id: projectId,
          doc_id: doc.id
        });
      }

      onProgress?.(0.15); // 15%

      // 2. Generate AI Summary & Keywords (in parallel with chunking)
      const summaryPromise = processWithModel(apiKey, withFormattedOutput(
        `Summarize this document in 2-3 sentences:\n\n${text.substring(0, 3000)}`,
        'summary'
      ));
      const keywordsPromise = processWithModel(apiKey, withFormattedOutput(
        `Extract 5-10 key topics/keywords from this document as a comma-separated list:\n\n${text.substring(0, 3000)}`,
        'summary'
      ));

      onProgress?.(0.25); // 25%

      // 3. Chunk Text
      const chunks = this.chunkText(text, 1000, 100);

      onProgress?.(0.30); // 30%

      // 4. Generate Embeddings
      const embeddingsData = [];
      const maxChunks = Math.min(chunks.length, 50);

      for (let i = 0; i < maxChunks; i++) {
        const chunk = chunks[i];
        if (i > 0) await new Promise(r => setTimeout(r, 200));

        // Progress from 30% to 70% during embedding generation
        const embeddingProgress = 0.30 + (i / maxChunks) * 0.40;
        onProgress?.(embeddingProgress);

        const embedding = await generateEmbedding(apiKey, chunk);

        if (embedding) {
          embeddingsData.push({
            doc_id: doc.id,
            content: chunk,
            embedding,
            chunk_index: i
          });
        }
      }

      onProgress?.(0.75); // 75%

      if (embeddingsData.length > 0) {
        const { error: embError } = await supabase
          .from('doc_embeddings')
          .insert(embeddingsData);

        if (embError) console.error('Error saving embeddings', embError);
      }

      onProgress?.(0.85); // 85%

      // 5. Save summary & keywords
      const [summary, keywordsStr] = await Promise.all([summaryPromise, keywordsPromise]);
      const keywords = keywordsStr?.split(',').map(k => k.trim()).filter(Boolean) || [];

      onProgress?.(0.95); // 95%

      await supabase.from('knowledge_docs').update({
        is_processed: true,
        processing_status: 'completed',
        ai_summary: summary || 'No summary available',
        ai_keywords: keywords
      }).eq('id', doc.id);

      onProgress?.(1.0); // 100%

      return { ...doc, ai_summary: summary, ai_keywords: keywords };
    } catch (error) {
      // Mark document as failed on any error
      console.error('Document processing failed:', error);
      await supabase.from('knowledge_docs').update({
        is_processed: false,
        processing_status: 'failed',
        ai_summary: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }).eq('id', doc.id);
      throw error;
    }
  },

  chunkText(text: string, size: number, overlap: number): string[] {
    const chunks = [];
    for (let i = 0; i < text.length; i += (size - overlap)) {
      chunks.push(text.slice(i, i + size));
    }
    return chunks;
  },

  async searchSimilar(apiKey: string, query: string, userId?: string, projectId?: string): Promise<any[]> {
    console.log('🔍 searchSimilar called with:');
    console.log('   Query:', query);
    console.log('   User ID:', userId);
    console.log('   Project ID:', projectId);
    
    const embedding = await generateEmbedding(apiKey, query);
    
    if (!embedding) {
      console.error('❌ Failed to generate query embedding');
      return [];
    }
    
    console.log('✅ Query embedding generated:', embedding.length, 'dimensions');

    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.5, 
      match_count: 5,
      filter_user_id: userId || null
    });

    console.log('📊 Database RPC result:');
    console.log('   Error:', error);
    console.log('   Data:', data);
    console.log('   Results count:', data?.length || 0);

    if (error) {
      console.error('❌ Vector search error:', error);
      return [];
    }

    // Filter by project if specified
    if (projectId && data) {
      console.log('🔍 Filtering by project:', projectId);
      
      const { data: projectDocs } = await supabase
        .from('project_docs')
        .select('doc_id')
        .eq('project_id', projectId);
      
      console.log('   Project docs:', projectDocs);
      
      const projectDocIds = new Set(projectDocs?.map(pd => pd.doc_id) || []);
      const filtered = data.filter((d: any) => projectDocIds.has(d.doc_id));
      
      console.log('   Filtered results:', filtered.length);
      
      return filtered;
    }

    return data || [];
  },

  // Projects
  async createProject(userId: string, name: string, description?: string, color?: string) {
    return await supabase.from('ai_projects').insert({
      user_id: userId,
      name,
      description,
      color: color || '#f43f5e' // Pulse rose
    }).select().single();
  },

  async getProjects(userId: string) {
    return await supabase
      .from('ai_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
  },

  async deleteProject(id: string) {
    return await supabase.from('ai_projects').delete().eq('id', id);
  },

  // Sessions (enhanced)
  async createSession(userId: string, title: string, description?: string, projectId?: string) {
    return await supabase.from('ai_sessions').insert({
      user_id: userId,
      title,
      description,
      project_id: projectId
    }).select().single();
  },

  async getSessions(userId: string, projectId?: string) {
    let query = supabase
      .from('ai_sessions')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    
    return await query;
  },

  async getMessages(sessionId: string) {
    return await supabase
      .from('ai_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
  },

  async addMessage(sessionId: string, userId: string | null, role: 'user' | 'assistant', content: string, citations: any[] = []) {
    return await supabase.from('ai_messages').insert({
      session_id: sessionId,
      user_id: userId,
      role,
      content,
      citations
    }).select().single();
  },

  // Thinking Logs
  async saveThinkingLog(messageId: string, steps: ThinkingStep[]) {
    const totalTime = steps.reduce((sum, s) => sum + s.duration_ms, 0);
    return await supabase.from('ai_thinking_logs').insert({
      message_id: messageId,
      thinking_steps: steps,
      total_thinking_time_ms: totalTime
    }).select().single();
  },

  async getThinkingLog(messageId: string) {
    return await supabase
      .from('ai_thinking_logs')
      .select('*')
      .eq('message_id', messageId)
      .single();
  },

  // Prompt Suggestions
  async generateSuggestions(apiKey: string, sessionId: string, recentMessages: string[], documents: any[]) {
    const context = `Recent conversation:\n${recentMessages.join('\n')}\n\nAvailable documents: ${documents.map(d => d.title).join(', ')}`;
    
    const suggestionsText = await processWithModel(
      apiKey, 
      withFormattedOutput(
        `Based on this conversation and available documents, suggest 3 follow-up questions or prompts the user might want to explore. Return as JSON array of strings.\n\n${context}`,
        'research'
      )
    );

    if (!suggestionsText) return [];

    try {
      const suggestions = JSON.parse(suggestionsText.replace(/```json\n?|\n?```/g, ''));
      
      // Save to DB
      const records = suggestions.map((text: string) => ({
        session_id: sessionId,
        suggestion_text: text,
        context_summary: 'Auto-generated based on conversation',
        relevance_score: 0.8
      }));

      await supabase.from('ai_prompt_suggestions').insert(records);
      
      return suggestions;
    } catch (e) {
      console.error('Failed to parse suggestions', e);
      return [];
    }
  },

  async getSuggestions(sessionId: string) {
    return await supabase
      .from('ai_prompt_suggestions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('is_used', false)
      .order('created_at', { ascending: false })
      .limit(5);
  },

  async markSuggestionUsed(id: string) {
    return await supabase
      .from('ai_prompt_suggestions')
      .update({ is_used: true })
      .eq('id', id);
  },
  
  async getDocuments(userId: string, projectId?: string) {
    console.log('[RAG Service] getDocuments called:', { userId, projectId });
    
    if (projectId) {
      // Get docs for specific project
      const { data: projectDocs, error: projectDocsError } = await supabase
        .from('project_docs')
        .select('doc_id')
        .eq('project_id', projectId);
      
      console.log('[RAG Service] Project docs query result:', { projectDocs, error: projectDocsError });
      
      if (projectDocsError) {
        console.error('[RAG Service] Error fetching project docs:', projectDocsError);
        return { data: [], error: projectDocsError };
      }
      
      if (!projectDocs || projectDocs.length === 0) {
        console.log('[RAG Service] No documents found for project');
        return { data: [], error: null };
      }

      const docIds = projectDocs.map(pd => pd.doc_id);
      console.log('[RAG Service] Fetching documents for IDs:', docIds);
      
      const result = await supabase
        .from('knowledge_docs')
        .select('*')
        .in('id', docIds)
        .order('created_at', { ascending: false });
      
      console.log('[RAG Service] Documents fetched:', result.data?.length || 0);
      return result;
    }

    // Get all docs for user (when viewing "All Projects")
    console.log('[RAG Service] Fetching all documents for user');
    const result = await supabase
      .from('knowledge_docs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    console.log('[RAG Service] Documents fetched:', result.data?.length || 0);
    return result;
  },
  
  async deleteDocument(id: string) {
    console.log('[RAG Service] Deleting document:', id);
    
    // Delete in order: embeddings first, then project links, then the document
    // This ensures referential integrity even if cascade isn't set up

    // 1. Delete embeddings
    const { error: embError } = await supabase
      .from('doc_embeddings')
      .delete()
      .eq('doc_id', id);

    if (embError) {
      console.error('[RAG Service] Error deleting embeddings:', embError);
      return { error: embError };
    }
    console.log('[RAG Service] Embeddings deleted successfully');

    // 2. Delete project-doc links
    const { error: linkError } = await supabase
      .from('project_docs')
      .delete()
      .eq('doc_id', id);

    if (linkError) {
      console.error('[RAG Service] Error deleting project links:', linkError);
      // Don't return error here as the document might not be linked to any project
    }
    console.log('[RAG Service] Project links deleted successfully');

    // 3. Delete the document itself
    const result = await supabase.from('knowledge_docs').delete().eq('id', id);
    
    if (result.error) {
      console.error('[RAG Service] Error deleting document:', result.error);
    } else {
      console.log('[RAG Service] Document deleted successfully from database');
    }
    
    return result;
  },
  
  async deleteSession(id: string) {
    return await supabase.from('ai_sessions').delete().eq('id', id);
  },

  // Retry processing for stuck/failed documents
  async retryDocumentProcessing(apiKey: string, docId: string, onProgress?: (progress: number) => void) {
    // Get the document
    const { data: doc, error: docError } = await supabase
      .from('knowledge_docs')
      .select('*')
      .eq('id', docId)
      .single();

    if (docError || !doc) throw docError || new Error('Document not found');
    if (!doc.text_content) throw new Error('No text content to process');

    // Reset status
    await supabase.from('knowledge_docs').update({
      processing_status: 'processing',
      is_processed: false
    }).eq('id', docId);

    try {
      onProgress?.(0.10);

      // Delete old embeddings
      await supabase.from('doc_embeddings').delete().eq('doc_id', docId);

      onProgress?.(0.20);

      // Re-generate AI Summary & Keywords
      const summaryPromise = processWithModel(apiKey, `Summarize this document in 2-3 sentences:\n\n${doc.text_content.substring(0, 3000)}`);
      const keywordsPromise = processWithModel(apiKey, `Extract 5-10 key topics/keywords from this document as a comma-separated list:\n\n${doc.text_content.substring(0, 3000)}`);

      onProgress?.(0.30);

      // Re-chunk and embed
      const chunks = this.chunkText(doc.text_content, 1000, 100);
      const embeddingsData = [];
      const maxChunks = Math.min(chunks.length, 50);

      for (let i = 0; i < maxChunks; i++) {
        const chunk = chunks[i];
        if (i > 0) await new Promise(r => setTimeout(r, 200));

        const embeddingProgress = 0.30 + (i / maxChunks) * 0.40;
        onProgress?.(embeddingProgress);

        const embedding = await generateEmbedding(apiKey, chunk);

        if (embedding) {
          embeddingsData.push({
            doc_id: docId,
            content: chunk,
            embedding,
            chunk_index: i
          });
        }
      }

      onProgress?.(0.75);

      if (embeddingsData.length > 0) {
        const { error: embError } = await supabase
          .from('doc_embeddings')
          .insert(embeddingsData);

        if (embError) console.error('Error saving embeddings', embError);
      }

      onProgress?.(0.85);

      const [summary, keywordsStr] = await Promise.all([summaryPromise, keywordsPromise]);
      const keywords = keywordsStr?.split(',').map(k => k.trim()).filter(Boolean) || [];

      onProgress?.(0.95);

      await supabase.from('knowledge_docs').update({
        is_processed: true,
        processing_status: 'completed',
        ai_summary: summary || 'No summary available',
        ai_keywords: keywords
      }).eq('id', docId);

      onProgress?.(1.0);

      return { ...doc, ai_summary: summary, ai_keywords: keywords };
    } catch (error) {
      console.error('Document reprocessing failed:', error);
      await supabase.from('knowledge_docs').update({
        is_processed: false,
        processing_status: 'failed',
        ai_summary: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }).eq('id', docId);
      throw error;
    }
  }
};
