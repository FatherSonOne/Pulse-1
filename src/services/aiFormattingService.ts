/**
 * AI Output Formatting Service
 *
 * Provides consistent formatting instructions for all AI outputs across Pulse.
 * Voice is calm and precise: hierarchy comes from typography and structure,
 * never from decorative emoji. Status and priority are conveyed in words here,
 * and rendered as real UI indicators (dots, pills, badges) by the components.
 */

export const AI_FORMATTING_INSTRUCTIONS = `
FORMATTING GUIDELINES — apply to every response:

1. Voice: calm, precise, and direct. Write like a sharp assistant, not a
   cheerleader. No pep-talk, no motivational sign-offs, no exclamation-heavy
   encouragement.

2. No decorative emoji. Do not add emoji to headings, bullets, labels, or as
   status markers. Convey status and priority in words ("Urgent", "Overdue",
   "High priority"), never with glyphs. The interface renders its own status
   indicators.

3. Hierarchy through type, not decoration:
   - **Bold** for section labels, key terms, names, and deadlines.
   - *Italic* sparingly, for a genuine aside or caveat.
   - Bullet points (•) or numbered lists for anything scannable.
   - Line breaks between sections.

4. Every word earns its place. Cut restated headings and filler intros. Lead
   with the most important item.

Example — do this:
"**Today**

**Top priority:** Finish the project proposal, due 5 PM.
**Quick wins:** Reply to 3 pending emails; schedule the catch-up with Sarah."

Not this:
"🎯 **Top Priority**: Complete project proposal... You've got this! 💪"

Format for clarity. Make it fast to read.
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
 * Get context-specific formatting hints based on the type of AI interaction.
 * All hints are emoji-free; status is expressed in words and rendered by the UI.
 */
export function getContextualFormattingHints(context: FormattingContext): string {
  const hints: Record<string, string> = {
    briefing: `
Briefing format:
- Open with a brief, plain greeting. No fanfare.
- Lead with the single most important item, labelled **Top priority**.
- Group the rest under short **bold** labels. Keep each line scannable.
- Flag time-sensitive items in words ("Overdue", "Due 5 PM"), not glyphs.
- End when the information ends. No motivational sign-off.`,

    research: `
Research format:
- Structure: Problem → Analysis → Findings → Recommendations.
- **Bold** key findings and conclusions.
- *Italic* for genuine caveats or limitations.
- Cite sources plainly. State uncertainty where it exists.`,

    chat: `
Conversational format:
- Be natural, direct, and concise. Match the user's energy.
- Use **bold** only for genuine emphasis. Short answers can stay short.`,

    analysis: `
Analysis format:
- Lead with the headline trend in words.
- **Bold** statistics and key metrics.
- Structure data with bullets and clear sections.
- Call out critical insights plainly; do not decorate them.`,

    summary: `
Summary format:
- Lead with **Key takeaways**.
- Mark items as done or pending in words, not glyphs.
- Keep it concise and structured for scanning.
- End with next steps only if there are any.`,

    'email-draft': `
Email draft format:
- Structure: Greeting → Context → Main message → Next steps → Sign-off.
- Professional, warm, and economical. **Bold** the key ask or action.
- *Italic* for a gentle suggestion. Short, scannable paragraphs.
- Close simply. No emoji.`,

    'email-analysis': `
Email analysis format:
- Structure: Summary → Key points → Suggested actions → Priority.
- **Bold** sender names, key topics, and action items.
- State urgency and sentiment in words ("urgent", "positive tone").
- The UI renders priority and sentiment indicators; do not add glyphs.`,

    journal: `
Journal insight format:
- Structure: Observation → Reflection → Gentle suggestion.
- Warm, supportive, and non-judgmental, but not saccharine.
- *Italic* for gentle reflections. No emoji, no cheerleading.`,

    'voice-analysis': `
Voice analysis format:
- Structure: Overview → Key points → Action items → Tone.
- **Bold** key topics and important phrases.
- Identify speakers and action items in words.`,

    'meeting-notes': `
Meeting notes format:
- Structure: Attendees → Agenda → Discussion → Decisions → Action items → Next steps.
- **Bold** action items with owner names and deadlines.
- State decisions and deadlines plainly.`,

    'task-extraction': `
Task extraction format:
- For each task: Title → Description → Priority → Due date.
- **Bold** task titles and deadlines.
- State priority in words ("High", "Medium", "Low"); the UI colours it.
- Name the assignee if mentioned. Keep descriptions actionable.`,

    'team-health': `
Team health format:
- Structure: Overall status → Strengths → Areas for improvement → Recommendations.
- **Bold** key metrics and trends.
- State each area's status in words ("Healthy", "Needs attention", "Critical");
  the UI renders the health indicators.`,

    nudge: `
Nudge format:
- One or two sentences. Friendly, direct, not pushy.
- **Bold** the single action or reminder.
- No emoji. Example: "Quick reminder to **follow up with Sarah** about the proposal."`,

    'image-analysis': `
Image analysis format:
- Structure: Scene description → Key elements → Notable details → Insights.
- **Bold** main subjects and key elements.
- Describe plainly. No decorative emoji.`,

    code: `
Code format:
- Structure: Purpose → Implementation → Key points.
- **Bold** function names, variables, and key concepts.
- Flag gotchas and best practices in words. Keep code blocks clean.`,

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

Apply these guidelines to your entire response. Keep it clean, well-structured, and free of decorative emoji.`;
}

/**
 * Format plain text output to add basic formatting if AI didn't apply it
 * (Fallback function - AI should ideally format natively)
 */
export function enhancePlainTextOutput(text: string): string {
  if (!text) return text;

  // Don't enhance if already formatted
  if (text.includes('**') || text.includes('*')) {
    return text;
  }

  // Basic enhancement fallback: bold common leading labels, no emoji.
  let enhanced = text;
  enhanced = enhanced.replace(/^(Action Item|Task|Todo):/gim, '**$1**:');
  enhanced = enhanced.replace(/^(Priority|Important|Urgent):/gim, '**$1**:');
  enhanced = enhanced.replace(/^(Insight|Finding|Discovery):/gim, '**$1**:');
  enhanced = enhanced.replace(/^(Summary|Overview):/gim, '**$1**:');
  enhanced = enhanced.replace(/^(Analysis|Data|Metrics):/gim, '**$1**:');

  return enhanced;
}

/**
 * Parse formatted AI output for rendering
 * Supports markdown-like syntax: **bold**, *italic*
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

  return html;
}

/**
 * Remove decorative emoji and pictographs from AI-authored display text.
 *
 * The formatting guidelines instruct the model to avoid decorative emoji, but
 * models comply imperfectly. Apply this at the boundary to AI-authored strings
 * that render in the calm, precise UI surfaces (briefing, nudges, summaries) so
 * a stray glyph can never leak into the interface. Collapses the whitespace the
 * removed glyph leaves behind. Does NOT touch user-authored content or reactions.
 */
export function stripDecorativeEmoji(text: string): string {
  if (!text) return text;
  return text
    // Emoji, pictographs, symbols, dingbats, and variation/ZWJ modifiers.
    .replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{200D}]/gu,
      ''
    )
    // Tidy up doubled spaces and leading/trailing space a removed glyph leaves.
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
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
