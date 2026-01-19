// ============================================
// MSW (Mock Service Worker) Handlers
// API mocking for tests
// ============================================

import { http, HttpResponse } from 'msw';

// Base URLs for different services
const SUPABASE_URL = 'https://test.supabase.co';
const OPENAI_URL = 'https://api.openai.com';
const ANTHROPIC_URL = 'https://api.anthropic.com';
const GOOGLE_AI_URL = 'https://generativelanguage.googleapis.com';

export const handlers = [
  // ============================================
  // SUPABASE API MOCKS
  // ============================================

  // Auth endpoints
  http.post(`${SUPABASE_URL}/auth/v1/token`, () => {
    return HttpResponse.json({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      user: {
        id: 'mock-user-id',
        email: 'test@example.com',
      },
    });
  }),

  // Messages endpoints
  http.get(`${SUPABASE_URL}/rest/v1/messages`, () => {
    return HttpResponse.json([
      {
        id: 'msg-1',
        content: 'Hello world',
        sender_id: 'user-1',
        channel_id: 'channel-1',
        created_at: new Date().toISOString(),
      },
      {
        id: 'msg-2',
        content: 'How are you?',
        sender_id: 'user-2',
        channel_id: 'channel-1',
        created_at: new Date().toISOString(),
      },
    ]);
  }),

  http.post(`${SUPABASE_URL}/rest/v1/messages`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: 'msg-new',
      ...body,
      created_at: new Date().toISOString(),
    }, { status: 201 });
  }),

  // Channels endpoints
  http.get(`${SUPABASE_URL}/rest/v1/message_channels`, () => {
    return HttpResponse.json([
      {
        id: 'channel-1',
        name: 'general',
        workspace_id: 'workspace-1',
      },
    ]);
  }),

  // ============================================
  // AI PROVIDER MOCKS
  // ============================================

  // OpenAI GPT-4
  http.post(`${OPENAI_URL}/v1/chat/completions`, async ({ request }) => {
    const body: any = await request.json();
    const lastMessage = body.messages[body.messages.length - 1];

    return HttpResponse.json({
      id: 'chatcmpl-mock',
      object: 'chat.completion',
      created: Date.now(),
      model: body.model || 'gpt-4',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: `AI response to: ${lastMessage.content.substring(0, 50)}...`,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    });
  }),

  // OpenAI Embeddings
  http.post(`${OPENAI_URL}/v1/embeddings`, () => {
    return HttpResponse.json({
      object: 'list',
      data: [
        {
          object: 'embedding',
          embedding: Array(1536).fill(0).map(() => Math.random()),
          index: 0,
        },
      ],
      model: 'text-embedding-ada-002',
      usage: {
        prompt_tokens: 8,
        total_tokens: 8,
      },
    });
  }),

  // Anthropic Claude
  http.post(`${ANTHROPIC_URL}/v1/messages`, async ({ request }) => {
    const body: any = await request.json();
    const lastMessage = body.messages[body.messages.length - 1];

    return HttpResponse.json({
      id: 'msg-mock',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: `Claude response to: ${lastMessage.content.substring(0, 50)}...`,
        },
      ],
      model: body.model || 'claude-sonnet-4',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 100,
        output_tokens: 50,
      },
    });
  }),

  // Google Gemini
  http.post(`${GOOGLE_AI_URL}/v1beta/models/:model:generateContent`, async ({ request }) => {
    const body: any = await request.json();
    const lastPart = body.contents[body.contents.length - 1];

    return HttpResponse.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: `Gemini response to: ${lastPart.parts[0].text.substring(0, 50)}...`,
              },
            ],
            role: 'model',
          },
          finishReason: 'STOP',
          index: 0,
        },
      ],
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 50,
        totalTokenCount: 150,
      },
    });
  }),

  // ============================================
  // BRAINSTORM SERVICE MOCKS
  // ============================================

  // Mock AI clustering
  http.post('/api/brainstorm/cluster', async ({ request }) => {
    const body: any = await request.json();
    return HttpResponse.json({
      clusters: [
        {
          name: 'Technical Implementation',
          theme: 'Development and architecture',
          ideaIds: body.ideas.slice(0, Math.ceil(body.ideas.length / 2)).map((i: any) => i.id),
          confidence: 0.85,
        },
        {
          name: 'User Experience',
          theme: 'Design and usability',
          ideaIds: body.ideas.slice(Math.ceil(body.ideas.length / 2)).map((i: any) => i.id),
          confidence: 0.78,
        },
      ],
    });
  }),

  // Mock idea expansion
  http.post('/api/brainstorm/expand', async ({ request }) => {
    const body: any = await request.json();
    return HttpResponse.json({
      description: 'Detailed expansion of the idea with specific implementation details and considerations.',
      benefits: [
        'Improved user engagement',
        'Reduced development time',
        'Better performance',
      ],
      challenges: [
        'Technical complexity',
        'Resource requirements',
      ],
      nextSteps: [
        'Create proof of concept',
        'Gather user feedback',
        'Plan implementation',
      ],
    });
  }),

  // Mock idea variations
  http.post('/api/brainstorm/variations', async ({ request }) => {
    const body: any = await request.json();
    return HttpResponse.json({
      variations: [
        { type: 'SIMPLIFIED', text: 'Simplified version of the idea', rationale: 'Focuses on core value' },
        { type: 'AMPLIFIED', text: 'Amplified version of the idea', rationale: 'Maximum impact approach' },
        { type: 'COMBINED', text: 'Combined approach', rationale: 'Merges multiple concepts' },
        { type: 'OPPOSITE', text: 'Opposite approach', rationale: 'Alternative perspective' },
        { type: 'ALTERNATIVE', text: 'Alternative path', rationale: 'Different implementation' },
      ],
    });
  }),

  // ============================================
  // MESSAGE ENHANCEMENTS MOCKS
  // ============================================

  // Tone analysis
  http.post('/api/message/analyze-tone', async ({ request }) => {
    const body: any = await request.json();
    return HttpResponse.json({
      sentiment: 'positive',
      confidence: 0.82,
      tone: 'professional',
      suggestions: [
        'Consider adding a warmer greeting',
        'The tone is appropriate for business communication',
      ],
    });
  }),

  // Smart compose suggestions
  http.post('/api/message/suggestions', async ({ request }) => {
    const body: any = await request.json();
    const input = body.input || '';
    return HttpResponse.json({
      suggestions: [
        { text: `${input} I hope this message finds you well.`, confidence: 0.85 },
        { text: `${input} Let me know if you have any questions.`, confidence: 0.78 },
        { text: `${input} Looking forward to your response.`, confidence: 0.72 },
      ],
    });
  }),

  // Auto-response check
  http.post('/api/message/auto-response', async ({ request }) => {
    const body: any = await request.json();
    return HttpResponse.json({
      shouldRespond: false,
      response: null,
    });
  }),
];
