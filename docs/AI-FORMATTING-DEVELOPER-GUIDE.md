# 🚀 Developer Guide: Using AI Formatting

## Quick Start

### 1. Import the Service
```typescript
import { withFormattedOutput, getContextualFormattingHints } from '../services/aiFormattingService';
```

### 2. Wrap Your AI Prompts
```typescript
// Before
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'Your prompt here'
});

// After
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: withFormattedOutput(
    'Your prompt here',
    'contextType' // briefing, research, chat, analysis, summary, or default
  )
});
```

### 3. Choose the Right Context

| Context Type | When to Use | Example Use Cases |
|--------------|-------------|-------------------|
| `'briefing'` | Daily/periodic updates | Dashboard briefings, morning summaries |
| `'research'` | Research & investigation | War Room research, deep analysis |
| `'chat'` | Conversational AI | Chatbots, smart replies, casual interactions |
| `'analysis'` | Data & metrics | Analytics, reports, insights |
| `'summary'` | Condensed information | Document summaries, meeting notes |
| `'default'` | General purpose | When unsure, use this |

---

## Examples by Use Case

### Example 1: Adding a New Dashboard Widget

```typescript
import { withFormattedOutput } from '../services/aiFormattingService';
import { processWithModel } from '../services/geminiService';

export const generateTaskSummary = async (apiKey: string, tasks: Task[]) => {
  const taskContext = tasks.map(t => `- ${t.title} (${t.priority})`).join('\n');
  
  const prompt = `Analyze these tasks and provide a summary with recommendations:
  
${taskContext}

Focus on priorities and suggest what to tackle first.`;
  
  const response = await processWithModel(
    apiKey,
    withFormattedOutput(prompt, 'summary')  // ✅ Formatted output
  );
  
  return response;
};

// Result will include:
// 📝 **Task Summary**
// 
// 🎯 **Top Priority**
// • [Most urgent task with **bold** emphasis]
// 
// ⚡ **Quick Wins**
// • [Easy tasks to build momentum]
// 
// 💡 **Recommendation**: Start with...
```

---

### Example 2: Adding a New Chat Feature

```typescript
import { withFormattedOutput } from '../services/aiFormattingService';

export const generateFriendlyResponse = async (apiKey: string, userMessage: string) => {
  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: withFormattedOutput(
      `Respond to this message in a friendly, helpful way: "${userMessage}"`,
      'chat'  // ✅ Chat context = conversational tone
    )
  });
  
  return response.text;
};

// Result will be:
// - Conversational with emojis 😊
// - Friendly tone
// - Action-oriented
// - Natural and human
```

---

### Example 3: Adding Email Analysis

```typescript
export const analyzeEmailSentiment = async (apiKey: string, emailBody: string) => {
  const response = await processWithModel(
    apiKey,
    withFormattedOutput(
      `Analyze the sentiment and tone of this email:
      
${emailBody}

Provide insights about the sender's mood and suggested response approach.`,
      'analysis'  // ✅ Analysis context
    )
  );
  
  return response;
};

// Result will include:
// 📊 **Email Sentiment Analysis**
//
// **Tone Detected**: *Professional with slight urgency*
// 
// 🎯 **Key Indicators**:
// • Use of deadline language
// • Formal greeting
// • **Action items present**
//
// 💡 **Response Strategy**: Be prompt and professional...
```

---

### Example 4: Adding Research Feature

```typescript
export const investigateTopic = async (apiKey: string, topic: string, documents: string[]) => {
  const docContext = documents.join('\n\n---\n\n');
  
  const response = await processWithModel(
    apiKey,
    withFormattedOutput(
      `Research the topic: "${topic}"
      
Using these documents:
${docContext}

Provide a comprehensive analysis with sources and conclusions.`,
      'research'  // ✅ Research context
    )
  );
  
  return response;
};

// Result will include:
// 🔍 **Research Analysis: [Topic]**
//
// 📚 **Sources Reviewed**: [List with citations]
//
// 💡 **Key Findings**:
// 1. [Finding with **emphasis**]
// 2. [Another finding]
//
// 📊 **Data Points**:
// • [Stat] - *Source reference*
//
// ⚠️ **Limitations**: [Caveats in italics]
//
// 🎯 **Conclusion**: [Summary with recommendations]
```

---

## Advanced Usage

### Custom Context Hints

If you need specialized formatting:

```typescript
import { getContextualFormattingHints, AI_FORMATTING_INSTRUCTIONS } from '../services/aiFormattingService';

const customPrompt = `Your specific instructions...

${getContextualFormattingHints('research')}

Additional context-specific rules...`;
```

### Rendering Formatted Output

If you need to render formatted text in the UI:

```typescript
import { formatToHTML, parseFormattedText } from '../services/aiFormattingService';

// Convert to HTML for rendering
const html = formatToHTML(aiResponse);

// Or parse segments for custom rendering
const segments = parseFormattedText(aiResponse);
segments.forEach(segment => {
  if (segment.bold) {
    // Render as <strong>
  } else if (segment.italic) {
    // Render as <em>
  } else {
    // Render as plain text
  }
});
```

### Stripping Formatting

For plain text export:

```typescript
import { stripFormatting } from '../services/aiFormattingService';

const plainText = stripFormatting(formattedAIResponse);
// "Your text" instead of "**Your text**"
```

---

## Common Patterns

### Pattern 1: Fetch + Format

```typescript
const getData = async () => {
  const data = await fetchData();
  const prompt = withFormattedOutput(
    `Analyze this data: ${JSON.stringify(data)}`,
    'analysis'
  );
  return await processWithModel(apiKey, prompt);
};
```

### Pattern 2: Context + Format

```typescript
const getContextualAdvice = async (userContext: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    systemInstruction: withFormattedOutput(
      `You are a helpful assistant with this context: ${userContext}`,
      'chat'
    ),
    contents: userMessage
  });
  return response.text;
};
```

### Pattern 3: Multi-Step with Different Contexts

```typescript
// Step 1: Analyze (analysis context)
const analysis = await processWithModel(
  apiKey,
  withFormattedOutput('Analyze this situation...', 'analysis')
);

// Step 2: Summarize (summary context)
const summary = await processWithModel(
  apiKey,
  withFormattedOutput(`Summarize: ${analysis}`, 'summary')
);

// Step 3: Chat response (chat context)
const response = await processWithModel(
  apiKey,
  withFormattedOutput(`Based on: ${summary}, respond to user`, 'chat')
);
```

---

## Best Practices

### ✅ DO:
- Choose the most appropriate context type
- Let AI format natively (it's trained for this!)
- Use formatting consistently across features
- Test with real prompts to see output quality
- Keep prompts clear and specific

### ❌ DON'T:
- Over-format prompts manually (let AI handle it)
- Mix multiple contexts in one prompt
- Use DEFAULT for everything (be specific!)
- Strip emojis in user-facing output
- Forget to handle null/error cases

---

## Troubleshooting

### "AI Output Not Formatted"

**Check:**
1. Is `withFormattedOutput()` wrapping the prompt?
2. Is the correct context type used?
3. Is the AI model recent enough? (gemini-2.5+ recommended)
4. Are you catching/logging the actual output?

**Debug:**
```typescript
const prompt = withFormattedOutput('Test', 'chat');
console.log('Formatted prompt:', prompt); // Should include formatting instructions
```

### "Too Much Formatting"

If output is overly formatted:
```typescript
// Use more conservative context
withFormattedOutput(prompt, 'default')

// Or specify in prompt
withFormattedOutput(
  'Be concise and use minimal formatting...',
  'chat'
)
```

### "Formatting Doesn't Match UI"

Make sure UI can render:
- Emojis (UTF-8 encoding)
- Bold (**text**)
- Italic (*text*)
- Line breaks (\n)

Use `formatToHTML()` if rendering in HTML:
```typescript
<div dangerouslySetInnerHTML={{ __html: formatToHTML(aiOutput) }} />
```

---

## Testing Your Implementation

### Test Checklist:

```typescript
// 1. Test basic formatting
const test1 = await processWithModel(apiKey, withFormattedOutput(
  'Tell me about productivity',
  'chat'
));
console.assert(test1.includes('📊') || test1.includes('**'), 'Should include formatting');

// 2. Test context switching
const test2 = await processWithModel(apiKey, withFormattedOutput(
  'Analyze these numbers: 1, 2, 3',
  'analysis'
));
console.assert(test2.includes('📊') || test2.includes('**Data'), 'Should use analysis formatting');

// 3. Test all contexts
const contexts = ['briefing', 'research', 'chat', 'analysis', 'summary', 'default'];
for (const ctx of contexts) {
  const result = await processWithModel(apiKey, withFormattedOutput('Test', ctx as any));
  console.log(`${ctx}:`, result.substring(0, 100));
}
```

---

## Real-World Examples from Pulse

### 1. Dashboard Briefing
**File**: `src/services/geminiService.ts`
```typescript
export const generateDailyBriefing = async (apiKey: string, context: string) => {
  // ...
  contents: withFormattedOutput(basePrompt, 'briefing')
  // ...
};
```

### 2. Research Mission
**File**: `src/services/ragService.ts`
```typescript
const summaryPromise = processWithModel(apiKey, withFormattedOutput(
  `Summarize this document...`,
  'summary'
));
```

### 3. Smart Replies
**File**: `src/services/geminiService.ts`
```typescript
export const generateSmartReply = async (apiKey: string, history: any[]) => {
  // ...
  contents: withFormattedOutput(prompt, 'chat')
  // ...
};
```

---

## 🎉 You're Ready!

Now you can add beautiful, formatted AI outputs to any feature in Pulse!

### Quick Reference:
```typescript
// Briefing (morning summaries, updates)
withFormattedOutput(prompt, 'briefing')

// Research (deep analysis, findings)
withFormattedOutput(prompt, 'research')

// Chat (conversations, replies)
withFormattedOutput(prompt, 'chat')

// Analysis (data, metrics, insights)
withFormattedOutput(prompt, 'analysis')

// Summary (condensed info, takeaways)
withFormattedOutput(prompt, 'summary')

// Default (general purpose)
withFormattedOutput(prompt, 'default')
```

**Happy formatting! ✨**
