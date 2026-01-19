/**
 * Pulse Public API - Supabase Edge Function
 * Provides REST API access to Pulse features via API keys
 *
 * Endpoints:
 * - GET  /projects - List all projects
 * - GET  /projects/:id - Get a project
 * - POST /projects - Create a project
 * - GET  /projects/:id/documents - List documents in a project
 * - POST /projects/:id/documents - Add a document to a project
 * - POST /projects/:id/chat - Send a message to the project AI
 * - GET  /messages - List messages (with filters)
 * - POST /capture - Quick capture content (from extension)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Response helpers
function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message, success: false }, status);
}

// Parse URL path
function parsePath(url: URL): { segments: string[], params: URLSearchParams } {
  const pathname = url.pathname.replace(/^\/public-api/, '').replace(/^\/api\/v1/, '');
  const segments = pathname.split('/').filter(Boolean);
  return { segments, params: url.searchParams };
}

// Validate API key and get user context
async function validateRequest(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const apiKeyHeader = req.headers.get('x-api-key') || '';

  const apiKey = authHeader.startsWith('Bearer ')
    ? authHeader.replace('Bearer ', '')
    : apiKeyHeader;

  if (!apiKey || !apiKey.startsWith('pk_')) {
    return { valid: false, error: 'Missing or invalid API key. Use Authorization: Bearer pk_... header' };
  }

  // Create admin client to validate API key
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Validate API key using the database function
  const { data, error } = await supabase.rpc('validate_api_key', {
    p_api_key: apiKey
  });

  if (error) {
    console.error('API key validation error:', error);
    return { valid: false, error: 'Failed to validate API key' };
  }

  const result = data?.[0];
  if (!result || !result.is_valid) {
    return { valid: false, error: result?.error_message || 'Invalid API key' };
  }

  return {
    valid: true,
    userId: result.user_id,
    keyId: result.key_id,
    scopes: result.scopes as string[],
    supabase
  };
}

// Check if user has required scope
function hasScope(scopes: string[], required: string): boolean {
  if (scopes.includes('admin')) return true;
  if (required === 'read') return scopes.includes('read') || scopes.includes('write');
  if (required === 'write') return scopes.includes('write');
  if (required === 'delete') return scopes.includes('delete');
  return false;
}

// Log API request
async function logRequest(
  supabase: any,
  keyId: string,
  userId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number,
  req: Request,
  errorMessage?: string
) {
  try {
    await supabase.from('api_request_logs').insert({
      api_key_id: keyId,
      user_id: userId,
      endpoint,
      method,
      status_code: statusCode,
      response_time_ms: responseTimeMs,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
      user_agent: req.headers.get('user-agent'),
      error_message: errorMessage
    });
  } catch (err) {
    console.error('Failed to log request:', err);
  }
}

serve(async (req) => {
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const { segments, params } = parsePath(url);
    const method = req.method;

    // Validate API key
    const auth = await validateRequest(req);
    if (!auth.valid) {
      return errorResponse(auth.error!, 401);
    }

    const { userId, keyId, scopes, supabase } = auth;

    // Route handlers
    let response: Response;

    try {
      // GET /projects - List projects
      if (method === 'GET' && segments[0] === 'projects' && !segments[1]) {
        if (!hasScope(scopes, 'read')) {
          response = errorResponse('Insufficient permissions', 403);
        } else {
          const { data, error } = await supabase
            .from('ai_projects')
            .select('id, name, description, icon, color, is_shared, created_at, updated_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (error) throw error;
          response = jsonResponse({ success: true, data });
        }
      }

      // GET /projects/:id - Get a project
      else if (method === 'GET' && segments[0] === 'projects' && segments[1] && !segments[2]) {
        if (!hasScope(scopes, 'read')) {
          response = errorResponse('Insufficient permissions', 403);
        } else {
          const { data, error } = await supabase
            .from('ai_projects')
            .select('*')
            .eq('id', segments[1])
            .eq('user_id', userId)
            .single();

          if (error) {
            response = errorResponse('Project not found', 404);
          } else {
            response = jsonResponse({ success: true, data });
          }
        }
      }

      // POST /projects - Create a project
      else if (method === 'POST' && segments[0] === 'projects' && !segments[1]) {
        if (!hasScope(scopes, 'write')) {
          response = errorResponse('Insufficient permissions', 403);
        } else {
          const body = await req.json();
          const { data, error } = await supabase
            .from('ai_projects')
            .insert({
              user_id: userId,
              name: body.name || 'New Project',
              description: body.description || '',
              icon: body.icon || 'folder',
              color: body.color || '#f43f5e'
            })
            .select()
            .single();

          if (error) throw error;
          response = jsonResponse({ success: true, data }, 201);
        }
      }

      // GET /projects/:id/documents - List documents
      else if (method === 'GET' && segments[0] === 'projects' && segments[2] === 'documents') {
        if (!hasScope(scopes, 'read')) {
          response = errorResponse('Insufficient permissions', 403);
        } else {
          const { data, error } = await supabase
            .from('knowledge_docs')
            .select('id, title, source_type, source_url, text_content, created_at')
            .eq('project_id', segments[1])
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (error) throw error;
          response = jsonResponse({ success: true, data });
        }
      }

      // POST /projects/:id/documents - Add a document
      else if (method === 'POST' && segments[0] === 'projects' && segments[2] === 'documents') {
        if (!hasScope(scopes, 'write')) {
          response = errorResponse('Insufficient permissions', 403);
        } else {
          const body = await req.json();

          if (!body.title || !body.content) {
            response = errorResponse('title and content are required');
          } else {
            const { data, error } = await supabase
              .from('knowledge_docs')
              .insert({
                user_id: userId,
                project_id: segments[1],
                title: body.title,
                source_type: body.source_type || 'text',
                source_url: body.source_url || null,
                text_content: body.content.substring(0, 100000) // 100k limit
              })
              .select()
              .single();

            if (error) throw error;
            response = jsonResponse({ success: true, data }, 201);
          }
        }
      }

      // POST /projects/:id/chat - Chat with project AI
      else if (method === 'POST' && segments[0] === 'projects' && segments[2] === 'chat') {
        if (!hasScope(scopes, 'write')) {
          response = errorResponse('Insufficient permissions', 403);
        } else {
          const body = await req.json();

          if (!body.message) {
            response = errorResponse('message is required');
          } else {
            // Get or create session
            let sessionId = body.session_id;

            if (!sessionId) {
              const { data: session, error } = await supabase
                .from('ai_sessions')
                .insert({
                  user_id: userId,
                  project_id: segments[1],
                  title: body.message.substring(0, 50) + '...'
                })
                .select()
                .single();

              if (error) throw error;
              sessionId = session.id;
            }

            // Save user message
            await supabase.from('ai_messages').insert({
              user_id: userId,
              session_id: sessionId,
              role: 'user',
              content: body.message
            });

            // For now, return a placeholder response
            // In production, this would call the RAG service
            const aiResponse = `This is a placeholder response from the Pulse API. Your message: "${body.message}" would normally be processed by our RAG system with your project's documents as context.`;

            // Save AI response
            const { data: savedMessage, error: msgError } = await supabase
              .from('ai_messages')
              .insert({
                user_id: userId,
                session_id: sessionId,
                role: 'assistant',
                content: aiResponse
              })
              .select()
              .single();

            if (msgError) throw msgError;

            response = jsonResponse({
              success: true,
              data: {
                session_id: sessionId,
                message: aiResponse,
                created_at: savedMessage.created_at
              }
            });
          }
        }
      }

      // GET /messages - List messages
      else if (method === 'GET' && segments[0] === 'messages') {
        if (!hasScope(scopes, 'read')) {
          response = errorResponse('Insufficient permissions', 403);
        } else {
          const limit = parseInt(params.get('limit') || '50');
          const sessionId = params.get('session_id');

          let query = supabase
            .from('ai_messages')
            .select('id, session_id, role, content, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(Math.min(limit, 100));

          if (sessionId) {
            query = query.eq('session_id', sessionId);
          }

          const { data, error } = await query;
          if (error) throw error;
          response = jsonResponse({ success: true, data });
        }
      }

      // POST /capture - Quick capture (for browser extension)
      else if (method === 'POST' && segments[0] === 'capture') {
        if (!hasScope(scopes, 'write')) {
          response = errorResponse('Insufficient permissions', 403);
        } else {
          const body = await req.json();

          if (!body.content) {
            response = errorResponse('content is required');
          } else {
            // Get or create default project
            let projectId = body.project_id;

            if (!projectId) {
              // Try to get user's first project or create one
              const { data: projects } = await supabase
                .from('ai_projects')
                .select('id')
                .eq('user_id', userId)
                .limit(1);

              if (projects && projects.length > 0) {
                projectId = projects[0].id;
              } else {
                // Create default project
                const { data: newProject, error } = await supabase
                  .from('ai_projects')
                  .insert({
                    user_id: userId,
                    name: 'Captures',
                    description: 'Quick captures from browser extension',
                    icon: 'bookmark',
                    color: '#f43f5e'
                  })
                  .select()
                  .single();

                if (error) throw error;
                projectId = newProject.id;
              }
            }

            // Create the document
            const { data, error } = await supabase
              .from('knowledge_docs')
              .insert({
                user_id: userId,
                project_id: projectId,
                title: body.title || 'Quick Capture',
                source_type: body.type || 'text',
                source_url: body.url || null,
                text_content: body.content.substring(0, 100000)
              })
              .select()
              .single();

            if (error) throw error;

            response = jsonResponse({
              success: true,
              data: {
                id: data.id,
                project_id: projectId,
                title: data.title,
                created_at: data.created_at
              }
            }, 201);
          }
        }
      }

      // GET /me - Get current API key info
      else if (method === 'GET' && segments[0] === 'me') {
        const { data, error } = await supabase
          .from('api_keys')
          .select('name, scopes, rate_limit, last_used_at, created_at')
          .eq('id', keyId)
          .single();

        if (error) throw error;
        response = jsonResponse({ success: true, data });
      }

      // 404 for unknown routes
      else {
        response = errorResponse(`Unknown endpoint: ${method} /${segments.join('/')}`, 404);
      }

    } catch (routeError: any) {
      console.error('Route error:', routeError);
      response = errorResponse(routeError.message || 'Internal error', 500);
    }

    // Log the request
    const responseTime = Date.now() - startTime;
    const endpoint = `/${segments.join('/')}`;
    const statusMatch = response.status;

    await logRequest(
      supabase,
      keyId,
      userId,
      endpoint,
      method,
      statusMatch,
      responseTime,
      req,
      statusMatch >= 400 ? (await response.clone().json()).error : undefined
    );

    return response;

  } catch (error: any) {
    console.error('Edge function error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
});
