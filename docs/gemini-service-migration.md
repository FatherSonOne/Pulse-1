# Gemini Service Migration Guide

## Overview

This guide shows how to migrate from the insecure client-side API key usage to the secure proxy-based architecture.

## Current Architecture (INSECURE ❌)

```typescript
// ❌ INSECURE: API key exposed in browser
const apiKey = import.meta.env.VITE_GEMINI_API_KEY; // Visible in browser!

export const generateDailyBriefing = async (apiKey: string, context: string) => {
  const ai = new GoogleGenAI({ apiKey }); // Direct API call from browser
  // ...
};

// Usage
const result = await generateDailyBriefing(apiKey, context);
```

**Problems:**
- API key visible in browser DevTools
- Anyone can extract and use your API key
- No rate limiting
- No usage tracking
- API costs can spiral out of control

## New Architecture (SECURE ✅)

```typescript
// ✅ SECURE: API key managed server-side
import { apiProxyService } from './services/apiProxyService';

export const generateDailyBriefing = async (context: string) => {
  // No API key needed - handled by backend
  const result = await apiProxyService.geminiGenerateContent({
    model: 'gemini-2.5-flash',
    contents: withFormattedOutput(context, 'briefing'),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        // ... schema definition
      }
    }
  });

  return JSON.parse(result.text || '{}');
};

// Usage
const result = await generateDailyBriefing(context);
```

**Benefits:**
- ✅ API key never exposed to client
- ✅ Server-side rate limiting
- ✅ Usage tracking per user
- ✅ Retry logic with exponential backoff
- ✅ Input sanitization
- ✅ Error handling

## Migration Steps

### Step 1: Update Environment Variables

**Before (.env):**
```bash
VITE_GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**After (Backend .env):**
```bash
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**After (Frontend .env):**
```bash
VITE_BACKEND_API_URL=https://api.your-app.com
```

### Step 2: Initialize API Proxy Service

In your app initialization (e.g., `App.tsx`):

```typescript
import { apiProxyService } from './services/apiProxyService';
import { useAuthStore } from './stores/authStore';

function App() {
  const user = useAuthStore((state) => state.user);
  const sessionToken = useAuthStore((state) => state.sessionToken);

  useEffect(() => {
    if (user && sessionToken) {
      // Initialize proxy service with user context
      apiProxyService.initialize(user.id, sessionToken);
    }
  }, [user, sessionToken]);

  // ... rest of your app
}
```

### Step 3: Migrate Each Function

Here are examples for common Gemini service functions:

#### generateDailyBriefing

**Before:**
```typescript
export const generateDailyBriefing = async (apiKey: string, context: string) => {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: withFormattedOutput(context, 'briefing'),
    config: {
      responseMimeType: "application/json",
      responseSchema: { /* ... */ }
    }
  });
  return JSON.parse(response.text || '{}');
};
```

**After:**
```typescript
import { apiProxyService } from './services/apiProxyService';
import { sanitizationService } from './services/sanitizationService';

export const generateDailyBriefing = async (context: string) => {
  // Sanitize input
  const sanitizedContext = sanitizationService.sanitizeText(context);

  try {
    const response = await apiProxyService.geminiGenerateContent({
      model: 'gemini-2.5-flash',
      contents: withFormattedOutput(sanitizedContext, 'briefing'),
      config: {
        responseMimeType: "application/json",
        responseSchema: { /* ... */ }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error: any) {
    // Handle rate limit errors
    if (error.message.includes('Rate limit')) {
      throw new Error('Too many AI requests. Please wait a few minutes and try again.');
    }
    throw error;
  }
};
```

#### generateSmartReply

**Before:**
```typescript
export const generateSmartReply = async (
  apiKey: string,
  history: {role: string, text: string}[]
) => {
  const ai = new GoogleGenAI({ apiKey });
  const conversation = history.map(h => `${h.role}: ${h.text}`).join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: withFormattedOutput(/* prompt */, 'chat'),
  });
  return response.text;
};
```

**After:**
```typescript
import { apiProxyService } from './services/apiProxyService';
import { sanitizationService } from './services/sanitizationService';

export const generateSmartReply = async (
  history: {role: string, text: string}[]
) => {
  // Sanitize conversation history
  const sanitizedHistory = history.map(h => ({
    role: h.role,
    text: sanitizationService.sanitizeText(h.text)
  }));

  const conversation = sanitizedHistory.map(h => `${h.role}: ${h.text}`).join('\n');

  try {
    const response = await apiProxyService.geminiGenerateContent({
      model: 'gemini-2.5-flash-lite',
      contents: withFormattedOutput(/* prompt */, 'chat'),
    });

    return response.text;
  } catch (error) {
    console.error('Smart reply generation failed:', error);
    return null;
  }
};
```

#### transcribeMedia

**Before:**
```typescript
export const transcribeMedia = async (
  apiKey: string,
  mediaBase64: string,
  mimeType: string = 'audio/webm'
) => {
  const ai = new GoogleGenAI({ apiKey });
  const cleanMime = mimeType.split(';')[0].trim();

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { inlineData: { mimeType: cleanMime, data: mediaBase64 } },
        { text: "Transcribe the speech..." }
      ]
    },
  });
  return response.text;
};
```

**After:**
```typescript
import { apiProxyService } from './services/apiProxyService';

export const transcribeMedia = async (
  mediaBase64: string,
  mimeType: string = 'audio/webm'
) => {
  const cleanMime = mimeType.split(';')[0].trim();

  try {
    const response = await apiProxyService.geminiGenerateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: cleanMime, data: mediaBase64 } },
          { text: "Transcribe the speech in this media exactly as spoken. Do not add any commentary." }
        ]
      },
    });

    return response.text;
  } catch (error) {
    console.error("Transcription Error:", error);
    return null;
  }
};
```

#### generateImage

**Before:**
```typescript
export const generateImage = async (apiKey: string, prompt: string) => {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
  });
  // ... extract image data
};
```

**After:**
```typescript
import { apiProxyService } from './services/apiProxyService';
import { sanitizationService } from './services/sanitizationService';

export const generateImage = async (prompt: string) => {
  // Sanitize prompt
  const sanitizedPrompt = sanitizationService.sanitizeText(prompt, {
    maxLength: 500
  });

  try {
    const response = await apiProxyService.geminiGenerateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: sanitizedPrompt }] },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image generation error:", error);
    throw error;
  }
};
```

### Step 4: Update Component Usage

**Before:**
```typescript
import { generateDailyBriefing } from './services/geminiService';

function Dashboard() {
  const [briefing, setBriefing] = useState(null);
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY; // ❌ Exposed!

  const loadBriefing = async () => {
    const result = await generateDailyBriefing(apiKey, context);
    setBriefing(result);
  };

  // ...
}
```

**After:**
```typescript
import { generateDailyBriefing } from './services/geminiService';
import toast from 'react-hot-toast';

function Dashboard() {
  const [briefing, setBriefing] = useState(null);

  const loadBriefing = async () => {
    try {
      const result = await generateDailyBriefing(context);
      setBriefing(result);
    } catch (error: any) {
      if (error.message.includes('Rate limit')) {
        toast.error('Too many AI requests. Please wait a few minutes.');
      } else {
        toast.error('Failed to generate briefing');
      }
      console.error('Briefing error:', error);
    }
  };

  // ...
}
```

### Step 5: Handle Streaming Responses

**Before:**
```typescript
// Direct streaming not available in old implementation
```

**After:**
```typescript
import { apiProxyService } from './services/apiProxyService';

async function streamChatResponse(prompt: string) {
  const chunks: string[] = [];

  await apiProxyService.geminiStreamContent(
    {
      model: 'gemini-3-pro-preview',
      contents: prompt,
    },
    (chunk) => {
      chunks.push(chunk);
      // Update UI with chunk
      updateChatUI(chunk);
    }
  );

  return chunks.join('');
}
```

## Complete Example: Migrated Service

```typescript
/**
 * Gemini Service - Secure Proxy Version
 *
 * All API calls route through backend proxy.
 * No API keys exposed client-side.
 */

import { apiProxyService } from './services/apiProxyService';
import { sanitizationService } from './services/sanitizationService';
import { withFormattedOutput } from './aiFormattingService';
import { Type } from "@google/genai";

/**
 * Generate daily briefing
 */
export const generateDailyBriefing = async (context: string) => {
  const sanitizedContext = sanitizationService.sanitizeText(context);

  try {
    const response = await apiProxyService.geminiGenerateContent({
      model: 'gemini-2.5-flash',
      contents: withFormattedOutput(
        `Analyze this context and generate a daily briefing: ${sanitizedContext}`,
        'briefing'
      ),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            greeting: { type: Type.STRING },
            summary: { type: Type.STRING },
            highlights: { type: Type.ARRAY, items: { type: Type.OBJECT } },
            suggestions: { type: Type.ARRAY, items: { type: Type.OBJECT } },
            focusRecommendation: { type: Type.STRING }
          }
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error: any) {
    console.error('Briefing generation error:', error);

    if (error.message.includes('Rate limit')) {
      throw new Error('Too many AI requests. Please try again in a few minutes.');
    }

    return {
      greeting: "Welcome back.",
      summary: "Unable to generate briefing at this time.",
      highlights: [],
      suggestions: [],
      focusRecommendation: "Check your tasks and calendar."
    };
  }
};

/**
 * Generate smart reply
 */
export const generateSmartReply = async (
  history: {role: string, text: string}[]
) => {
  const sanitizedHistory = history.map(h => ({
    role: h.role,
    text: sanitizationService.sanitizeText(h.text)
  }));

  const conversation = sanitizedHistory.map(h => `${h.role}: ${h.text}`).join('\n');

  try {
    const response = await apiProxyService.geminiGenerateContent({
      model: 'gemini-2.5-flash-lite',
      contents: withFormattedOutput(
        `Generate a professional reply to this conversation:\n${conversation}`,
        'chat'
      ),
    });

    return response.text;
  } catch (error) {
    console.error('Smart reply generation failed:', error);
    return null;
  }
};

// Export remaining functions following the same pattern...
```

## Testing Your Migration

### 1. Verify API Keys

```bash
# Check that VITE_ prefixed keys are removed
grep -r "VITE_GEMINI_API_KEY" .env*
grep -r "VITE_OPENAI_API_KEY" .env*

# Should return nothing!
```

### 2. Test Backend API

```bash
# Test health endpoint
curl http://localhost:3001/api/health

# Test Gemini proxy (with valid JWT token)
curl -X POST http://localhost:3001/api/gemini/proxy \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generateContent",
    "model": "gemini-2.5-flash",
    "contents": "Hello!"
  }'
```

### 3. Test Frontend

```typescript
// In browser console
import { apiProxyService } from './services/apiProxyService';

// Should throw error if not initialized
await apiProxyService.geminiGenerateContent({
  model: 'gemini-2.5-flash',
  contents: 'test'
});

// After login and initialization
apiProxyService.initialize(userId, sessionToken);
await apiProxyService.geminiGenerateContent({
  model: 'gemini-2.5-flash',
  contents: 'test'
});
// Should work!
```

### 4. Check Rate Limiting

```typescript
// Make multiple rapid requests
for (let i = 0; i < 150; i++) {
  await generateSmartReply([{role: 'user', text: 'test'}]);
}
// Should hit rate limit after 100 requests
```

## Troubleshooting

### "API key not configured" error

**Problem:** Backend can't find the API key

**Solution:**
```bash
# Check backend .env file
cat .env | grep GEMINI_API_KEY

# Ensure no VITE_ prefix
GEMINI_API_KEY=your_key_here  # ✅ Correct
```

### "Rate limit exceeded" error

**Problem:** Too many requests in the time window

**Solution:**
```typescript
// Check rate limit status
const status = await apiProxyService.getRateLimitStatus('GEMINI');
console.log('Remaining requests:', status.remaining);
console.log('Reset in:', Math.ceil(status.retryAfter / 60000), 'minutes');
```

### CORS errors

**Problem:** Backend rejecting requests from frontend

**Solution:**
```javascript
// In backend server.js
const allowedOrigins = [
  'http://localhost:5173',  // Development
  'https://your-app.com',   // Production
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
```

## Checklist

- [ ] Backend API endpoints implemented
- [ ] Environment variables migrated
- [ ] Frontend uses apiProxyService
- [ ] All Gemini functions migrated
- [ ] Input sanitization added
- [ ] Rate limiting tested
- [ ] Error handling implemented
- [ ] Old VITE_ prefixed keys removed
- [ ] API keys rotated
- [ ] Documentation updated
- [ ] Team trained on new architecture

---

**Remember:** API key security is critical. Never expose keys client-side, always use server-side proxy architecture.
