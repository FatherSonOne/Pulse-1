# OpenAI Realtime Voice Agent - War Room Integration

## 🎯 Overview

The War Room now includes OpenAI's Realtime Voice Agent capabilities, providing speech-to-speech AI interactions with advanced features like tool calling, multi-agent handoffs, and output guardrails.

## 🚀 Features Implemented

### 1. **Real-time Voice Communication**
- WebRTC-based low-latency voice streaming
- Automatic echo cancellation and noise suppression
- Semantic VAD (Voice Activity Detection) for natural turn-taking
- Support for interruptions and mid-conversation corrections

### 2. **Multi-Agent System**
Four specialized War Room agents with handoff capabilities:

| Agent | Role | Specialization |
|-------|------|----------------|
| **General** | Default coordinator | Project navigation, general queries |
| **Analyst** | Deep research | Data analysis, pattern identification |
| **Scribe** | Documentation | Meeting notes, decision recording |
| **Strategist** | Planning | Decision-making, risk assessment |

### 3. **Voice-Enabled Tools**
- `search_documents` - Semantic search in knowledge base
- `create_task` - Create tasks with voice (requires approval)
- `create_decision` - Record decisions (requires approval)
- `get_project_summary` - Project overview
- `generate_summary` - Summarize conversations
- `search_messages` - Search conversation history
- `set_reminder` - Set reminders

### 4. **Output Guardrails**
- Content safety (sensitive data detection)
- Profanity filtering
- Professional advice prevention
- Personal information request detection
- Hallucination detection (soft warning)
- Brand voice compliance

### 5. **Human-in-the-Loop**
- Approval dialogs for sensitive tool calls
- Approve/reject interface for tasks and decisions
- Transparent tool execution visibility

## 📁 File Structure

```
src/
├── services/
│   ├── realtimeAgentService.ts    # Core realtime session management
│   ├── warRoomToolsService.ts     # Voice-enabled tools
│   └── voiceGuardrailsService.ts  # Output guardrails
│
├── components/WarRoom/
│   ├── RealtimeVoiceAgent.tsx     # Main voice interface component
│   ├── VoiceSessionHistory.tsx    # Conversation history panel
│   ├── VoiceAgentPanel.tsx        # Full-featured voice panel
│   └── index.ts                   # Exports
│
└── components/
    └── LiveDashboard.tsx          # Integration point
```

## 🔧 Configuration

### Required API Keys

1. **OpenAI API Key** - Store in `localStorage` as `openai_api_key`
   ```javascript
   localStorage.setItem('openai_api_key', 'sk-...');
   ```

### Voice Settings

Available voices:
- `nova` (Female, default)
- `alloy` (Neutral)
- `echo` (Male)
- `fable` (Neutral)
- `onyx` (Male)
- `shimmer` (Female)
- `sage` (Neutral)
- `coral` (Female)
- `verse` (Neutral)

### Turn Detection Modes

1. **Semantic VAD** (Recommended)
   - Smart detection based on speech content
   - Configurable eagerness: `low`, `medium`, `high`

2. **Server VAD**
   - Threshold-based silence detection
   - Configurable threshold and silence duration

## 🎮 Usage

### Accessing the Voice Agent

1. Open the War Room (LiveDashboard)
2. Click the **"AI Voice"** button (robot icon) in the header
3. Grant microphone permissions when prompted
4. Start speaking!

### Voice Commands

The agent understands natural language. Examples:
- "Search for documents about project planning"
- "Create a task to review the quarterly report"
- "Record a decision that we're moving forward with option A"
- "Give me a summary of this project"
- "Switch to the analyst agent"

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Escape` | Minimize panel |
| `Ctrl+H` | Toggle history |

## 🔌 API Reference

### RealtimeVoiceSession

```typescript
import { createRealtimeSession, generateEphemeralToken } from './services/realtimeAgentService';

// Create session
const session = createRealtimeSession(userId, {
  model: 'gpt-realtime',
  voice: 'nova',
  turnDetection: {
    type: 'semantic_vad',
    eagerness: 'medium',
  },
}, projectId, sessionId);

// Generate ephemeral token (for WebRTC)
const token = await generateEphemeralToken(openaiApiKey, {
  model: 'gpt-realtime',
  voice: 'nova',
});

// Connect
await session.connect(token);

// Event listeners
session.on('transcript_delta', (event) => {
  console.log(`${event.role}: ${event.delta}`);
});

session.on('agent_switched', (event) => {
  console.log(`Switched from ${event.fromAgent} to ${event.toAgent}`);
});

// Send text message
session.sendMessage('Hello!');

// Interrupt
session.interrupt();

// Disconnect
await session.disconnect();
```

### Registering Custom Tools

```typescript
import { z } from 'zod';
import { RealtimeTool } from './services/realtimeAgentService';

const myTool: RealtimeTool = {
  name: 'my_custom_tool',
  description: 'Does something useful',
  parameters: z.object({
    input: z.string().describe('The input to process'),
  }),
  needsApproval: false,
  execute: async (args, context) => {
    return `Processed: ${args.input}`;
  },
};

session.registerTool(myTool);
```

### Registering Guardrails

```typescript
import { RealtimeOutputGuardrail } from './services/realtimeAgentService';

const myGuardrail: RealtimeOutputGuardrail = {
  name: 'My Guardrail',
  execute: async ({ agentOutput }) => {
    const isViolation = agentOutput.includes('forbidden');
    return {
      tripwireTriggered: isViolation,
      outputInfo: { reason: 'Contains forbidden content' },
    };
  },
};

session.registerGuardrail(myGuardrail);
```

## 🔒 Security Considerations

1. **Ephemeral Tokens**: Use ephemeral tokens for client-side connections
2. **Tool Approvals**: Sensitive actions require user approval
3. **Guardrails**: Content is monitored for safety violations
4. **RLS Policies**: Database access respects Supabase RLS

## 🐛 Troubleshooting

### "OpenAI API key not configured"
Set the API key in localStorage:
```javascript
localStorage.setItem('openai_api_key', 'your-key');
```

### Microphone not working
- Check browser permissions
- Ensure HTTPS connection
- Try refreshing the page

### Connection fails
- Verify API key is valid
- Check network connectivity
- Review browser console for errors

### Agent not responding
- Check if microphone is muted
- Verify turn detection settings
- Try interrupting and speaking again

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     VoiceAgentPanel                          │
│  ┌─────────────────────┐  ┌─────────────────────────────┐  │
│  │ RealtimeVoiceAgent  │  │   VoiceSessionHistory       │  │
│  │                     │  │                             │  │
│  │  ┌───────────────┐  │  │  - Message list             │  │
│  │  │ Audio Viz     │  │  │  - Tool calls               │  │
│  │  └───────────────┘  │  │  - Export options           │  │
│  │  ┌───────────────┐  │  └─────────────────────────────┘  │
│  │  │ Transcripts   │  │                                   │
│  │  └───────────────┘  │                                   │
│  │  ┌───────────────┐  │                                   │
│  │  │ Text Input    │  │                                   │
│  │  └───────────────┘  │                                   │
│  └─────────────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  RealtimeVoiceSession                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ WebRTC       │  │ Agent Defs   │  │ Tools            │  │
│  │ Connection   │  │ (4 agents)   │  │ (7 tools)        │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ History      │  │ Guardrails   │  │ Approval Queue   │  │
│  │ Management   │  │ (5 default)  │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    OpenAI Realtime API                       │
│                                                              │
│  - gpt-realtime model                                       │
│  - WebRTC transport                                         │
│  - Speech-to-speech                                         │
│  - Tool calling                                             │
└─────────────────────────────────────────────────────────────┘
```

## 🔮 Future Enhancements

- [ ] SIP/Twilio integration for phone calls
- [ ] Multi-language support
- [ ] Voice cloning/custom voices
- [ ] Persistent conversation memory
- [ ] Analytics dashboard
- [ ] Webhook integrations
- [ ] Background noise profiles
- [ ] Voice commands for UI navigation

## 📚 References

- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/guides/realtime)
- [OpenAI Agents SDK](https://github.com/openai/openai-agents-js)
- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
