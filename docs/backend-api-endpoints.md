# Backend API Endpoints Documentation

## Critical Security Update

This document describes the backend API endpoints required to properly secure your Pulse application. **API keys must NEVER be exposed client-side.**

## Overview

The Pulse application uses a proxy architecture where:
1. Client makes requests to your backend API
2. Backend validates requests and authenticates users
3. Backend makes actual API calls using server-side API keys
4. Backend returns responses to client

## Architecture Diagram

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Browser   │─────▶│ Backend API  │─────▶│   Gemini    │
│   (Client)  │◀─────│  (Node.js)   │◀─────│ OpenAI, etc │
└─────────────┘      └──────────────┘      └─────────────┘
  No API keys         Manages keys          External APIs
```

## Base Configuration

### Environment Variables (Backend)

Create a `.env` file in your backend directory:

```bash
# API Keys (Server-side ONLY - Never expose with VITE_ prefix)
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Database
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Security
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here

# Server
PORT=3001
NODE_ENV=production
ALLOWED_ORIGINS=https://your-app.com,https://www.your-app.com
```

### Frontend Environment Variables

In your frontend `.env`:

```bash
# Public variables (Safe to expose with VITE_ prefix)
VITE_BACKEND_API_URL=https://api.your-app.com
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# NEVER DO THIS (Security vulnerability):
# VITE_GEMINI_API_KEY=xxx  ❌ WRONG - Exposes key in browser
# VITE_OPENAI_API_KEY=xxx  ❌ WRONG - Exposes key in browser
```

## API Endpoints

### 1. Gemini API Proxy

#### POST `/api/gemini/proxy`

Proxy requests to Gemini API.

**Request Headers:**
```http
Authorization: Bearer <user_jwt_token>
Content-Type: application/json
X-User-ID: <user_id>
X-CSRF-Token: <csrf_token>
```

**Request Body:**
```json
{
  "action": "generateContent",
  "model": "gemini-2.5-flash",
  "contents": "Your prompt here",
  "config": {
    "temperature": 0.7
  }
}
```

**Response:**
```json
{
  "text": "Generated response...",
  "candidates": [...],
  "timestamp": "2024-01-20T12:00:00Z"
}
```

**Implementation (Node.js/Express):**

```javascript
const express = require('express');
const { GoogleGenAI } = require('@google/genai');

const router = express.Router();

// Middleware to authenticate user
const authenticateUser = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // Verify JWT token
    const decoded = verifyJWT(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Rate limiting middleware
const rateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 requests per hour
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/api/gemini/proxy', authenticateUser, rateLimiter, async (req, res) => {
  try {
    const { action, model, contents, config } = req.body;

    // Validate input
    if (!action || !model || !contents) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get API key from environment (server-side only)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY not configured');
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Initialize Gemini client
    const ai = new GoogleGenAI({ apiKey });

    // Make API call based on action
    let result;

    switch (action) {
      case 'generateContent':
        result = await ai.models.generateContent({
          model,
          contents,
          config,
        });
        break;

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }

    // Return result
    res.json({
      text: result.text,
      candidates: result.candidates,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Gemini API error:', error);

    // Don't expose internal errors to client
    res.status(500).json({
      error: 'Failed to process request',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

module.exports = router;
```

---

### 2. Gemini Streaming Endpoint

#### POST `/api/gemini/stream`

Stream responses from Gemini API.

**Request:** Same as `/api/gemini/proxy`

**Response:** Server-Sent Events (SSE) stream

**Implementation:**

```javascript
router.post('/api/gemini/stream', authenticateUser, rateLimiter, async (req, res) => {
  try {
    const { action, model, contents, config } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    const ai = new GoogleGenAI({ apiKey });

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream response
    const stream = await ai.models.streamGenerateContent({
      model,
      contents,
      config,
    });

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
    }

    res.end();

  } catch (error) {
    console.error('Streaming error:', error);
    res.status(500).json({ error: 'Streaming failed' });
  }
});
```

---

### 3. OpenAI API Proxy

#### POST `/api/openai/proxy`

Proxy requests to OpenAI API.

**Request Body:**
```json
{
  "action": "chatCompletion",
  "model": "gpt-4",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "temperature": 0.7
}
```

**Implementation:**

```javascript
const OpenAI = require('openai');

router.post('/api/openai/proxy', authenticateUser, rateLimiter, async (req, res) => {
  try {
    const { action, model, messages, temperature, max_tokens } = req.body;

    const apiKey = process.env.OPENAI_API_KEY;
    const openai = new OpenAI({ apiKey });

    switch (action) {
      case 'chatCompletion':
        const completion = await openai.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens,
        });

        res.json({
          choices: completion.choices,
          usage: completion.usage,
          timestamp: new Date().toISOString(),
        });
        break;

      default:
        res.status(400).json({ error: 'Unknown action' });
    }

  } catch (error) {
    console.error('OpenAI API error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});
```

---

### 4. Anthropic API Proxy

#### POST `/api/anthropic/proxy`

Proxy requests to Anthropic (Claude) API.

**Request Body:**
```json
{
  "action": "message",
  "model": "claude-3-opus-20240229",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "max_tokens": 1024
}
```

**Implementation:**

```javascript
const Anthropic = require('@anthropic-ai/sdk');

router.post('/api/anthropic/proxy', authenticateUser, rateLimiter, async (req, res) => {
  try {
    const { action, model, messages, max_tokens } = req.body;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const anthropic = new Anthropic({ apiKey });

    switch (action) {
      case 'message':
        const message = await anthropic.messages.create({
          model,
          messages,
          max_tokens,
        });

        res.json({
          content: message.content,
          usage: message.usage,
          timestamp: new Date().toISOString(),
        });
        break;

      default:
        res.status(400).json({ error: 'Unknown action' });
    }

  } catch (error) {
    console.error('Anthropic API error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});
```

---

### 5. CRM Proxy Endpoints

#### POST `/api/crm/proxy`

Proxy requests to CRM systems (HubSpot, Salesforce, Pipedrive).

**Request Body:**
```json
{
  "provider": "hubspot",
  "action": "getContacts",
  "data": {
    "limit": 100
  }
}
```

**Implementation:**

```javascript
const hubspot = require('@hubspot/api-client');
const jsforce = require('jsforce');

router.post('/api/crm/proxy', authenticateUser, rateLimiter, async (req, res) => {
  try {
    const { provider, action, data } = req.body;

    switch (provider) {
      case 'hubspot':
        const hubspotClient = new hubspot.Client({
          accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
        });

        // Handle different HubSpot actions
        // Implementation depends on specific CRM needs
        break;

      case 'salesforce':
        const sfConn = new jsforce.Connection({
          oauth2: {
            clientId: process.env.SALESFORCE_CLIENT_ID,
            clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
          },
        });

        // Handle Salesforce actions
        break;

      default:
        res.status(400).json({ error: 'Unknown CRM provider' });
    }

  } catch (error) {
    console.error('CRM API error:', error);
    res.status(500).json({ error: 'Failed to process CRM request' });
  }
});
```

---

### 6. Health Check Endpoint

#### GET `/api/health`

Check API health and availability.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T12:00:00Z",
  "services": {
    "gemini": true,
    "openai": true,
    "database": true
  }
}
```

**Implementation:**

```javascript
router.get('/api/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      gemini: !!process.env.GEMINI_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      database: true, // Add actual DB check
    },
  };

  res.json(health);
});
```

---

## Complete Backend Server Example

**server.js:**

```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Import routes
const geminiRoutes = require('./routes/gemini');
const openaiRoutes = require('./routes/openai');
const anthropicRoutes = require('./routes/anthropic');
const crmRoutes = require('./routes/crm');

// Mount routes
app.use('/api/gemini', geminiRoutes);
app.use('/api/openai', openaiRoutes);
app.use('/api/anthropic', anthropicRoutes);
app.use('/api/crm', crmRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend API server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔒 CORS origins: ${allowedOrigins.join(', ')}`);
});
```

---

## Security Best Practices

### 1. API Key Management

- ✅ Store API keys in backend environment variables
- ✅ Never commit API keys to version control
- ✅ Use different keys for development and production
- ✅ Rotate keys regularly
- ❌ Never expose API keys with VITE_ prefix
- ❌ Never include API keys in client-side code

### 2. Authentication & Authorization

```javascript
// Implement proper JWT verification
const jwt = require('jsonwebtoken');

function authenticateUser(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

### 3. Rate Limiting

Implement per-user and per-endpoint rate limiting:

```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 requests per hour
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});
```

### 4. Input Validation

Use validation libraries like Joi or Zod:

```javascript
const { z } = require('zod');

const geminiRequestSchema = z.object({
  action: z.enum(['generateContent', 'streamContent']),
  model: z.string(),
  contents: z.any(),
  config: z.object({}).optional(),
});

router.post('/api/gemini/proxy', authenticateUser, async (req, res) => {
  try {
    // Validate request
    const validated = geminiRequestSchema.parse(req.body);

    // Process request...
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }
    throw error;
  }
});
```

### 5. Logging & Monitoring

```javascript
// Log all API requests
app.use((req, res, next) => {
  console.log({
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    ip: req.ip,
  });
  next();
});

// Monitor API usage
const usage = {};
function trackUsage(userId, endpoint) {
  if (!usage[userId]) usage[userId] = {};
  if (!usage[userId][endpoint]) usage[userId][endpoint] = 0;
  usage[userId][endpoint]++;
}
```

---

## Deployment Checklist

- [ ] All API keys moved to backend environment variables
- [ ] VITE_ prefix removed from sensitive variables
- [ ] Frontend configured with VITE_BACKEND_API_URL
- [ ] Backend API endpoints implemented
- [ ] Authentication middleware in place
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] HTTPS enabled in production
- [ ] Security headers configured
- [ ] Error handling implemented
- [ ] Logging and monitoring set up
- [ ] API keys rotated after any exposure

---

## Testing

Test your backend API with curl:

```bash
# Test health check
curl http://localhost:3001/api/health

# Test Gemini proxy
curl -X POST http://localhost:3001/api/gemini/proxy \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generateContent",
    "model": "gemini-2.5-flash",
    "contents": "Hello, world!"
  }'
```

---

## Support

For questions or issues:
1. Check this documentation
2. Review the migration guide in `envValidation.ts`
3. Check the implementation examples in `apiProxyService.ts`
4. Contact your backend development team
