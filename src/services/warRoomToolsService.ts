/**
 * War Room Voice Agent Tools
 * Implements function tools for the realtime voice agents
 *
 * Tools available:
 * - rag_search: PRIMARY tool for searching context and knowledge base (use FIRST)
 * - report_grounding: Report sources used in responses
 * - search_documents: Search the knowledge base
 * - create_task: Create a new task
 * - create_decision: Record a decision
 * - get_project_summary: Get project overview
 * - search_messages: Search conversation history
 * - generate_summary: Summarize recent discussion
 */

import { z } from 'zod';
import { RealtimeTool, RealtimeToolContext } from './realtimeAgentService';
import { ragService } from './ragService';
import { processWithModel } from './geminiService';
import { contextBankService, SearchResult } from './contextBankService';

// ============= CITATION TRACKING =============

interface Citation {
  documentName: string;
  excerpt: string;
  similarity: number;
}

// Store citations for the current response (will be cleared after each response)
let currentCitations: Citation[] = [];

export function getCurrentCitations(): Citation[] {
  return [...currentCitations];
}

export function clearCitations(): void {
  currentCitations = [];
}

// ============= RAG SEARCH TOOL (PRIMARY) =============

/**
 * RAG Search Tool - PRIMARY tool for knowledge retrieval
 * This should be used FIRST before answering questions about documents or context
 */
export const ragSearchTool: RealtimeTool = {
  name: 'rag_search',
  description: 'CRITICAL: Use this tool FIRST before answering ANY question about documents, files, context, knowledge, or facts. This searches both uploaded context files and the knowledge base to find relevant information. Always search before making claims about document content.',
  parameters: z.object({
    query: z.string().describe('Natural language search query - what information are you looking for?'),
    searchType: z.enum(['all', 'context_only', 'knowledge_base_only']).optional().describe('Where to search: all (default), context_only (session files), or knowledge_base_only (Supabase)'),
  }),
  needsApproval: false,
  execute: async (args, context) => {
    const { query, searchType = 'all' } = args as { query: string; searchType?: 'all' | 'context_only' | 'knowledge_base_only' };

    if (!context?.userId) {
      return 'Error: User context not available';
    }

    const sessionId = context.sessionId || 'default';
    const apiKey = localStorage.getItem('gemini_api_key') || '';

    if (!apiKey) {
      return 'Error: API key not available for search. Please configure your Gemini API key in settings.';
    }

    console.log(`🔍 RAG Search: "${query}" (type: ${searchType})`);

    try {
      let results: SearchResult[] = [];

      // Search based on type
      if (searchType === 'all' || searchType === 'context_only') {
        // Search session context (uploaded files)
        const contextResults = await contextBankService.search(
          sessionId,
          query,
          apiKey,
          {
            includeSupabase: searchType === 'all',
            userId: context.userId,
            projectId: context.projectId,
          }
        );
        results = [...results, ...contextResults];
      }

      if (searchType === 'knowledge_base_only') {
        // Search only Supabase knowledge base
        const kbResults = await ragService.searchSimilar(
          apiKey,
          query,
          context.userId,
          context.projectId
        );

        for (const result of kbResults) {
          results.push({
            source: result.title || 'Knowledge Base Document',
            sourceId: result.doc_id || result.id,
            excerpt: result.content || '',
            similarity: result.similarity || 0.7,
            chunkIndex: result.chunk_index || 0,
          });
        }
      }

      // Deduplicate by content similarity
      const uniqueResults = results.filter((result, index, self) =>
        index === self.findIndex(r =>
          r.excerpt.substring(0, 100) === result.excerpt.substring(0, 100)
        )
      );

      // Sort by similarity
      uniqueResults.sort((a, b) => b.similarity - a.similarity);
      const topResults = uniqueResults.slice(0, 5);

      if (topResults.length === 0) {
        return `No relevant information found for "${query}". The knowledge base and context files don't contain information matching this query. You should inform the user that this information is not available in the provided documents.`;
      }

      // Store citations for later reporting
      currentCitations = topResults.map(r => ({
        documentName: r.source,
        excerpt: r.excerpt.substring(0, 200),
        similarity: r.similarity,
      }));

      // Format results for the model
      const formattedResults = topResults.map((result, i) => {
        const confidence = Math.round(result.similarity * 100);
        return `[Source ${i + 1}: ${result.source}] (${confidence}% relevant)\n${result.excerpt}`;
      }).join('\n\n---\n\n');

      return `Found ${topResults.length} relevant sources:\n\n${formattedResults}\n\nUse this information to answer the user's question. After responding, use the report_grounding tool to cite your sources.`;

    } catch (error) {
      console.error('RAG search error:', error);
      return `Error searching knowledge base: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
};

// ============= REPORT GROUNDING TOOL =============

/**
 * Report Grounding Tool
 * Used after answering a question to report which sources were used
 */
export const reportGroundingTool: RealtimeTool = {
  name: 'report_grounding',
  description: 'After answering a question using information from rag_search, use this tool to report which sources you cited. This helps track information provenance.',
  parameters: z.object({
    sources: z.array(z.object({
      documentName: z.string().describe('Name of the document or source'),
      relevantFact: z.string().describe('The specific fact or information used from this source'),
    })).describe('List of sources used in your response'),
    confidence: z.enum(['high', 'medium', 'low']).optional().describe('Overall confidence in the answer based on source quality'),
  }),
  needsApproval: false,
  execute: async (args, context) => {
    const { sources, confidence = 'medium' } = args as {
      sources: Array<{ documentName: string; relevantFact: string }>;
      confidence?: 'high' | 'medium' | 'low';
    };

    // Log the grounding for analytics
    console.log('📚 Response grounded in sources:', sources);
    console.log(`📊 Confidence level: ${confidence}`);

    // Store in session if available
    if (context?.sessionId) {
      try {
        const citationRecord = {
          timestamp: new Date().toISOString(),
          sources,
          confidence,
          storedCitations: currentCitations,
        };

        // Could store this in Supabase for analytics
        console.log('📝 Citation record:', citationRecord);
      } catch (e) {
        console.warn('Failed to store citation record:', e);
      }
    }

    // Clear current citations after reporting
    clearCitations();

    return `Sources recorded: ${sources.map(s => s.documentName).join(', ')}. Confidence: ${confidence}.`;
  },
};

// ============= TOOL DEFINITIONS =============

/**
 * Search Documents Tool
 * Searches the War Room knowledge base using semantic search
 */
export const searchDocumentsTool: RealtimeTool = {
  name: 'search_documents',
  description: 'Search the War Room knowledge base for relevant documents and information. Use this when the user asks about documents, files, or needs information from the knowledge base.',
  parameters: z.object({
    query: z.string().describe('The search query to find relevant documents'),
    maxResults: z.number().optional().describe('Maximum number of results to return (default: 5)'),
  }),
  needsApproval: false,
  execute: async (args, context) => {
    const { query, maxResults = 5 } = args as { query: string; maxResults?: number };
    
    if (!context?.userId) {
      return 'Error: User context not available';
    }

    try {
      // Get API key from localStorage
      const apiKey = localStorage.getItem('gemini_api_key') || '';
      if (!apiKey) {
        return 'Error: API key not available for document search.';
      }

      const results = await ragService.searchSimilar(
        apiKey,
        query,
        context.userId,
        context.projectId
      );

      if (!results || results.length === 0) {
        return `No documents found matching "${query}". The knowledge base may be empty or the query didn't match any content.`;
      }

      const formattedResults = results.slice(0, maxResults).map((doc: any, i: number) => {
        const similarity = Math.round((doc.similarity || 0) * 100);
        return `[${i + 1}] ${doc.title || 'Untitled'} (${similarity}% match)\n${doc.content?.substring(0, 200)}...`;
      }).join('\n\n');

      return `Found ${Math.min(results.length, maxResults)} relevant documents:\n\n${formattedResults}`;
    } catch (error) {
      console.error('Search documents error:', error);
      return `Error searching documents: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
};

/**
 * Create Task Tool
 * Creates a new task in the War Room
 */
export const createTaskTool: RealtimeTool = {
  name: 'create_task',
  description: 'Create a new task or action item. Use this when the user wants to track something that needs to be done.',
  parameters: z.object({
    title: z.string().describe('Short, action-oriented task title'),
    description: z.string().optional().describe('Detailed description of the task'),
    priority: z.enum(['low', 'medium', 'high']).optional().describe('Task priority level'),
    dueDate: z.string().optional().describe('Due date in ISO format (YYYY-MM-DD)'),
    assignee: z.string().optional().describe('Person responsible for the task'),
  }),
  needsApproval: true, // Require approval before creating tasks
  execute: async (args, context) => {
    const { title, description, priority = 'medium', dueDate, assignee } = args as {
      title: string;
      description?: string;
      priority?: 'low' | 'medium' | 'high';
      dueDate?: string;
      assignee?: string;
    };

    if (!context?.userId) {
      return 'Error: User context not available';
    }

    try {
      // For now, we'll store tasks as messages with a special format
      // In production, integrate with your task service
      const taskData = {
        type: 'task',
        title,
        description,
        priority,
        dueDate,
        assignee,
        createdAt: new Date().toISOString(),
        status: 'pending',
        projectId: context.projectId,
      };

      // Store in session if available
      if (context.sessionId) {
        await ragService.addMessage(
          context.sessionId,
          context.userId,
          'assistant',
          `[TASK CREATED]\nTitle: ${title}\nPriority: ${priority}\n${description ? `Description: ${description}\n` : ''}${dueDate ? `Due: ${dueDate}\n` : ''}${assignee ? `Assigned to: ${assignee}` : ''}`
        );
      }

      return `✅ Task created successfully!\n\nTitle: ${title}\nPriority: ${priority}${dueDate ? `\nDue: ${dueDate}` : ''}${assignee ? `\nAssigned to: ${assignee}` : ''}`;
    } catch (error) {
      console.error('Create task error:', error);
      return `Error creating task: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
};

/**
 * Create Decision Tool
 * Records a decision in the War Room
 */
export const createDecisionTool: RealtimeTool = {
  name: 'create_decision',
  description: 'Record a decision that was made. Use this when the user confirms a decision or conclusion.',
  parameters: z.object({
    decision: z.string().describe('The decision that was made'),
    context: z.string().optional().describe('Context or reasoning behind the decision'),
    stakeholders: z.array(z.string()).optional().describe('People involved in or affected by the decision'),
    alternatives: z.array(z.string()).optional().describe('Alternatives that were considered'),
  }),
  needsApproval: true, // Require approval before recording decisions
  execute: async (args, context) => {
    const { decision, context: decisionContext, stakeholders, alternatives } = args as {
      decision: string;
      context?: string;
      stakeholders?: string[];
      alternatives?: string[];
    };

    if (!context?.userId) {
      return 'Error: User context not available';
    }

    try {
      const decisionRecord = {
        type: 'decision',
        decision,
        context: decisionContext,
        stakeholders,
        alternatives,
        createdAt: new Date().toISOString(),
        projectId: context.projectId,
      };

      // Store in session if available
      if (context.sessionId) {
        let message = `[DECISION RECORDED]\n\n📋 Decision: ${decision}`;
        if (decisionContext) message += `\n\n📝 Context: ${decisionContext}`;
        if (stakeholders?.length) message += `\n\n👥 Stakeholders: ${stakeholders.join(', ')}`;
        if (alternatives?.length) message += `\n\n🔄 Alternatives considered: ${alternatives.join('; ')}`;

        await ragService.addMessage(context.sessionId, context.userId, 'assistant', message);
      }

      return `✅ Decision recorded!\n\nDecision: ${decision}${decisionContext ? `\n\nContext: ${decisionContext}` : ''}`;
    } catch (error) {
      console.error('Create decision error:', error);
      return `Error recording decision: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
};

/**
 * Get Project Summary Tool
 * Provides an overview of the current project
 */
export const getProjectSummaryTool: RealtimeTool = {
  name: 'get_project_summary',
  description: 'Get a summary of the current War Room project including documents and recent activity.',
  parameters: z.object({}),
  needsApproval: false,
  execute: async (args, context) => {
    if (!context?.userId) {
      return 'Error: User context not available';
    }

    try {
      // Get project info
      const { data: projects } = await ragService.getProjects(context.userId);
      const currentProject = projects?.find(p => p.id === context.projectId);

      // Get documents
      const { data: documents } = await ragService.getDocuments(context.userId, context.projectId);

      // Get recent sessions
      const { data: sessions } = await ragService.getSessions(context.userId, context.projectId);

      let summary = '';

      if (currentProject) {
        summary += `📁 Project: ${currentProject.name}\n`;
        if (currentProject.description) {
          summary += `📝 Description: ${currentProject.description}\n`;
        }
      } else {
        summary += '📁 No specific project selected (viewing all)\n';
      }

      summary += `\n📚 Documents: ${documents?.length || 0} files in knowledge base`;
      
      if (documents && documents.length > 0) {
        const recentDocs = documents.slice(0, 3);
        summary += '\n  Recent: ' + recentDocs.map(d => d.title || 'Untitled').join(', ');
      }

      summary += `\n\n💬 Sessions: ${sessions?.length || 0} conversations`;

      return summary;
    } catch (error) {
      console.error('Get project summary error:', error);
      return `Error getting project summary: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
};

/**
 * Generate Summary Tool
 * Summarizes the recent conversation or specific content
 */
export const generateSummaryTool: RealtimeTool = {
  name: 'generate_summary',
  description: 'Generate a summary of the recent conversation or specified content.',
  parameters: z.object({
    scope: z.enum(['recent', 'session', 'custom']).describe('What to summarize'),
    content: z.string().optional().describe('Custom content to summarize (if scope is "custom")'),
    format: z.enum(['brief', 'detailed', 'bullets']).optional().describe('Summary format'),
  }),
  needsApproval: false,
  execute: async (args, context) => {
    const { scope, content, format = 'brief' } = args as {
      scope: 'recent' | 'session' | 'custom';
      content?: string;
      format?: 'brief' | 'detailed' | 'bullets';
    };

    try {
      let textToSummarize = '';

      if (scope === 'custom' && content) {
        textToSummarize = content;
      } else if (context?.history) {
        // Get messages from history
        const messages = context.history
          .filter(item => item.type === 'message')
          .slice(scope === 'recent' ? -10 : 0)
          .map(item => `${item.role}: ${item.content || item.transcript}`)
          .join('\n');
        textToSummarize = messages;
      }

      if (!textToSummarize) {
        return 'No content available to summarize.';
      }

      const formatInstructions = {
        brief: 'Provide a 2-3 sentence summary.',
        detailed: 'Provide a comprehensive summary with key points.',
        bullets: 'Provide a bullet-point summary with key takeaways.',
      };

      const prompt = `Summarize the following conversation:\n\n${textToSummarize}\n\n${formatInstructions[format]}`;

      const apiKey = localStorage.getItem('gemini_api_key') || '';
      if (!apiKey) {
        return 'Error: API key not available for summarization.';
      }

      const summary = await processWithModel(apiKey, prompt);
      return `📋 Summary:\n\n${summary}`;
    } catch (error) {
      console.error('Generate summary error:', error);
      return `Error generating summary: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
};

/**
 * Search Messages Tool
 * Searches through conversation history
 */
export const searchMessagesTool: RealtimeTool = {
  name: 'search_messages',
  description: 'Search through conversation history for specific topics or content.',
  parameters: z.object({
    query: z.string().describe('Search query for messages'),
    role: z.enum(['all', 'user', 'assistant']).optional().describe('Filter by message role'),
  }),
  needsApproval: false,
  execute: async (args, context) => {
    const { query, role = 'all' } = args as { query: string; role?: 'all' | 'user' | 'assistant' };

    if (!context?.history || context.history.length === 0) {
      return 'No conversation history available to search.';
    }

    const queryLower = query.toLowerCase();
    const matches = context.history
      .filter(item => {
        if (item.type !== 'message') return false;
        if (role !== 'all' && item.role !== role) return false;
        const text = (item.content || item.transcript || '').toLowerCase();
        return text.includes(queryLower);
      })
      .slice(-10); // Limit to last 10 matches

    if (matches.length === 0) {
      return `No messages found matching "${query}".`;
    }

    const formatted = matches.map((item, i) => {
      const text = item.content || item.transcript || '';
      const preview = text.length > 100 ? text.substring(0, 100) + '...' : text;
      return `[${i + 1}] ${item.role}: ${preview}`;
    }).join('\n\n');

    return `Found ${matches.length} matching messages:\n\n${formatted}`;
  },
};

/**
 * Set Reminder Tool
 * Creates a reminder for the user
 */
export const setReminderTool: RealtimeTool = {
  name: 'set_reminder',
  description: 'Set a reminder for the user. Use this when the user wants to be reminded about something.',
  parameters: z.object({
    message: z.string().describe('What to remind the user about'),
    time: z.string().describe('When to remind (e.g., "in 5 minutes", "tomorrow at 9am", "next Monday")'),
  }),
  needsApproval: false,
  execute: async (args, context) => {
    const { message, time } = args as { message: string; time: string };

    // For now, we'll just acknowledge the reminder
    // In production, integrate with a notification service
    return `⏰ Reminder set!\n\nI'll remind you: "${message}"\nTime: ${time}\n\n(Note: In-app reminders coming soon. For now, please set a calendar reminder.)`;
  },
};

// ============= TOOL COLLECTION =============

/**
 * Core RAG tools - these should be registered first and used primarily
 */
export const RAG_TOOLS: RealtimeTool[] = [
  ragSearchTool,
  reportGroundingTool,
];

/**
 * All War Room tools including RAG tools
 */
export const WAR_ROOM_TOOLS: RealtimeTool[] = [
  ragSearchTool,        // PRIMARY - always search first
  reportGroundingTool,  // Report sources after answering
  searchDocumentsTool,  // Legacy - kept for backwards compatibility
  createTaskTool,
  createDecisionTool,
  getProjectSummaryTool,
  generateSummaryTool,
  searchMessagesTool,
  setReminderTool,
];

/**
 * Register all War Room tools with a realtime session
 */
export function registerWarRoomTools(session: { registerTool: (tool: RealtimeTool) => void }): void {
  WAR_ROOM_TOOLS.forEach(tool => {
    session.registerTool(tool);
  });
}

/**
 * Register only RAG tools (for lightweight sessions)
 */
export function registerRAGTools(session: { registerTool: (tool: RealtimeTool) => void }): void {
  RAG_TOOLS.forEach(tool => {
    session.registerTool(tool);
  });
}
