/**
 * AI Output Formatting Service
 * 
 * Provides consistent formatting instructions for all AI outputs across Pulse.
 * Ensures AI responses use emojis, bold, italic, and creative formatting for better readability.
 */

export const AI_FORMATTING_INSTRUCTIONS = `
🎨 **FORMATTING GUIDELINES** - Follow these rules for ALL responses:

1. **Use Emojis Strategically**:
   - Start sections with relevant emojis (📊 📅 ✅ ⚠️ 💡 🎯 📝 etc.)
   - Use emojis to highlight key points and add visual interest
   - Match emoji to content meaning (✨ for insights, 🚀 for action items, ⚡ for urgent, 💪 for encouragement)

2. **Text Formatting**:
   - **Bold** for titles, headers, and important key terms
   - *Italic* for emphasis, quotes, or subtle points
   - Use **bold + emoji** for major sections
   - Keep formatting natural and readable

3. **Structure & Hierarchy**:
   - Break content into clear sections with emoji headers
   - Use bullet points (•) or numbered lists
   - Add line breaks for readability
   - Highlight action items with ✅ or 🎯

4. **Tone & Style**:
   - Be friendly, professional, and encouraging
   - Use varied sentence structure
   - Add personality without being excessive
   - Make content scannable with formatting

5. **Examples**:
   ✅ GOOD:
   "📊 **Daily Summary**
   
   Good morning! Here's what needs your attention today:
   
   🎯 **Top Priority**: Complete project proposal (*deadline: 5 PM*)
   ✅ **Quick Wins**: Reply to 3 pending emails
   💡 **Opportunity**: Schedule that catch-up call with Sarah
   
   You've got this! 💪"
   
   ❌ AVOID:
   "Daily Summary:
   Complete project proposal by 5 PM.
   Reply to emails.
   Call Sarah."

Remember: **Format for humans**, not machines. Make it delightful to read! ✨
`;

/**
 * Context types for AI formatting
 */
export type FormattingContext =
  | 'briefing'
  | 'research'
  | 'chat'
  | 'analysis'
  | 'summary'
  | 'email-draft'
  | 'email-analysis'
  | 'journal'
  | 'voice-analysis'
  | 'meeting-notes'
  | 'task-extraction'
  | 'team-health'
  | 'nudge'
  | 'image-analysis'
  | 'code'
  | 'default';

/**
 * Get context-specific formatting hints based on the type of AI interaction
 */
export function getContextualFormattingHints(context: FormattingContext): string {
  const hints: Record<string, string> = {
    briefing: `
🌅 **Briefing Format**:
- Start with a warm greeting with time-appropriate emoji
- Use 🎯 for priorities, ⚠️ for urgent items
- End with encouraging message
- Keep it energetic and actionable`,

    research: `
🔍 **Research Format**:
- Use 📚 for sources, 💡 for insights, ⚠️ for limitations
- **Bold** key findings and conclusions
- *Italic* for nuanced points or caveats
- Structure: Problem → Analysis → Findings → Recommendations`,

    chat: `
💬 **Conversational Format**:
- Be natural and friendly with emojis
- Use formatting sparingly for emphasis
- Match user's energy level
- Quick responses can be shorter and punchier`,

    analysis: `
📊 **Analysis Format**:
- Start with 📈 or 📉 for trends
- **Bold** statistics and key metrics
- Use ⚡ for critical insights
- Structure data clearly with bullets and sections`,

    summary: `
📝 **Summary Format**:
- Lead with 🎯 **Key Takeaways**
- Use ✅ for completed items, ⏳ for pending
- Keep it concise but formatted for scanning
- End with next steps if applicable`,

    'email-draft': `
✉️ **Email Draft Format**:
- Use a friendly, professional greeting with 👋 if appropriate
- **Bold** key points and action items
- Use *italic* for emphasis or gentle suggestions
- Structure: Greeting → Context → Main Message → Next Steps → Sign-off
- Add 🎯 for clear call-to-action
- Keep paragraphs short and scannable
- End with a warm, encouraging close`,

    'email-analysis': `
📧 **Email Analysis Format**:
- Start with 📊 **Email Overview**
- Use ⚡ for urgent items, 💡 for insights
- **Bold** sender names, key topics, and action items
- Highlight sentiment with 😊 😐 😟 indicators
- Structure: Summary → Key Points → Suggested Actions → Priority Level
- Use 🏷️ for categorization suggestions`,

    journal: `
💭 **Journal Insight Format**:
- Start with empathetic acknowledgment
- Use 🌟 for positive observations, 💪 for encouragement
- *Italic* for gentle reflections and suggestions
- Keep tone warm, supportive, and non-judgmental
- End with an encouraging message and 🌈 or ✨
- Structure: Observation → Reflection → Gentle Suggestion → Encouragement`,

    'voice-analysis': `
🎙️ **Voice Analysis Format**:
- Start with 📝 **Transcription Summary**
- Use 🗣️ for speaker identification
- **Bold** key topics and important phrases
- Use ⚡ for action items mentioned, 💡 for insights
- Structure: Overview → Key Points → Action Items → Mood/Tone
- Add 🎯 for main takeaways`,

    'meeting-notes': `
📋 **Meeting Notes Format**:
- Start with 📅 **Meeting Summary** and date/participants
- Use 🎯 for objectives, ✅ for decisions made
- **Bold** action items with owner names
- Use ⏰ for deadlines mentioned
- Structure: Attendees → Agenda → Discussion Points → Decisions → Action Items → Next Steps
- End with 📌 **Follow-ups**`,

    'task-extraction': `
✅ **Task Extraction Format**:
- Use 🎯 for main tasks, ⚡ for urgent items
- **Bold** task titles and deadlines
- Structure each task: Title → Description → Priority → Due Date
- Use priority indicators: 🔴 High, 🟡 Medium, 🟢 Low
- Add 👤 for assigned person if mentioned
- Keep task descriptions actionable and clear`,

    'team-health': `
👥 **Team Health Format**:
- Start with 📊 **Team Health Overview**
- Use health indicators: 💚 Healthy, 💛 Needs Attention, 🔴 Critical
- **Bold** key metrics and trends
- Use 📈 for improvements, 📉 for concerns
- Structure: Overall Status → Strengths → Areas for Improvement → Recommendations
- End with 💡 **Actionable Suggestions**`,

    nudge: `
💬 **Nudge Format**:
- Keep it brief, friendly, and action-oriented
- Use a single relevant emoji to set tone
- **Bold** the key action or reminder
- Be encouraging, not pushy
- Add a touch of personality
- Example: "👋 Hey! Just a quick reminder to **follow up with Sarah** about the proposal. You've got this! 💪"`,

    'image-analysis': `
📸 **Image Analysis Format**:
- Start with 🖼️ **Image Overview**
- Use **Bold** for main subjects and key elements
- Structure: Scene Description → Key Elements → Notable Details → Insights
- Add relevant emojis for context (👤 people, 🏢 buildings, 🌳 nature, etc.)
- Use 💡 for observations and interpretations
- End with 🎯 **Key Takeaways** if applicable`,

    code: `
💻 **Code Format**:
- Keep explanations clear and technical
- Use **Bold** for function names, variables, and key concepts
- Structure: Purpose → Implementation → Key Points
- Use ⚠️ for potential issues or gotchas
- Add 💡 for best practices and tips
- Keep code blocks clean and well-commented`,

    default: AI_FORMATTING_INSTRUCTIONS
  };

  return hints[context] || hints.default;
}

/**
 * Wrap system prompts with formatting instructions
 */
export function withFormattedOutput(systemPrompt: string, context: FormattingContext = 'default'): string {
  return `${systemPrompt}

${getContextualFormattingHints(context)}

**CRITICAL**: Apply these formatting guidelines to your ENTIRE response. Every output should be well-formatted, emoji-enhanced, and visually engaging!`;
}

/**
 * Format plain text output to add basic formatting if AI didn't apply it
 * (Fallback function - AI should ideally format natively)
 */
export function enhancePlainTextOutput(text: string): string {
  if (!text) return text;
  
  // Don't enhance if already formatted
  if (text.includes('**') || text.includes('*') || /[🎯📊✅⚠️💡🚀⚡📝📅🔍💬📈]/.test(text)) {
    return text;
  }
  
  // Basic enhancement fallback
  let enhanced = text;
  
  // Add emoji to common patterns
  enhanced = enhanced.replace(/^(Action Item|Task|Todo):/gim, '✅ **$1**:');
  enhanced = enhanced.replace(/^(Priority|Important|Urgent):/gim, '⚡ **$1**:');
  enhanced = enhanced.replace(/^(Insight|Finding|Discovery):/gim, '💡 **$1**:');
  enhanced = enhanced.replace(/^(Summary|Overview):/gim, '📝 **$1**:');
  enhanced = enhanced.replace(/^(Analysis|Data|Metrics):/gim, '📊 **$1**:');
  
  return enhanced;
}

/**
 * Parse formatted AI output for rendering
 * Supports markdown-like syntax: **bold**, *italic*, emojis
 */
export interface FormattedSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  emoji?: boolean;
}

export function parseFormattedText(text: string): FormattedSegment[] {
  // Simple parser for bold and italic
  const segments: FormattedSegment[] = [];
  let currentPos = 0;
  
  // Regex to match **bold** or *italic*
  const formatRegex = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
  let match;
  
  while ((match = formatRegex.exec(text)) !== null) {
    // Add plain text before match
    if (match.index > currentPos) {
      segments.push({ text: text.substring(currentPos, match.index) });
    }
    
    // Add formatted segment
    if (match[1]) {
      // Bold
      segments.push({ text: match[2], bold: true });
    } else if (match[3]) {
      // Italic
      segments.push({ text: match[4], italic: true });
    }
    
    currentPos = match.index + match[0].length;
  }
  
  // Add remaining text
  if (currentPos < text.length) {
    segments.push({ text: text.substring(currentPos) });
  }
  
  return segments;
}

/**
 * Convert formatted text to HTML for rendering
 */
export function formatToHTML(text: string): string {
  if (!text) return '';
  
  let html = text;
  
  // Convert **bold** to <strong>
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Convert *italic* to <em>
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Preserve line breaks
  html = html.replace(/\n/g, '<br/>');
  
  // Emojis are already supported in HTML
  return html;
}

/**
 * Strip all formatting for plain text export
 */
export function stripFormatting(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1')     // Remove italic
    .trim();
}
