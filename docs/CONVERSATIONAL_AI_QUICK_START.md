# Conversational AI Assistant - Quick Start Guide

Get up and running with Pulse's AI-powered assistant in minutes!

---

## What is the AI Assistant?

The Conversational AI Assistant is your intelligent companion for managing decisions and tasks. It understands natural language, provides contextual insights, and can execute actions on your behalf.

**Key Capabilities:**
- Answer questions about your decisions and tasks
- Identify blockers and bottlenecks
- Suggest next actions and priorities
- Generate summaries and insights
- Execute actions (create decisions, update tasks)

---

## Setup (One-time)

### 1. Add Your Gemini API Key

The AI Assistant requires a Google Gemini API key to function.

**Get Your Free API Key:**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key

**Add to Pulse:**
1. Open Pulse application
2. Click Settings (gear icon)
3. Navigate to API Keys section
4. Paste your Gemini API key
5. Click Save

**Note:** Your API key is stored locally and never sent to Pulse servers.

---

## How to Use

### Opening the Assistant

1. Navigate to **Decisions & Tasks** page
2. Click the **"AI Assistant"** button in the top-right header
3. The assistant sidebar slides in from the right

### Quick Actions (Fastest Way to Start)

When you first open the assistant, you'll see **6 quick action chips** organized by category:

**Insights:**
- "What needs my attention?" - See urgent items
- "What's blocking me?" - Find workflow blockers

**Next Actions:**
- "Who should I follow up with?" - Get stakeholder suggestions
- "What should I work on next?" - Prioritized recommendations

**Summaries:**
- "Summarize pending items" - Overview of all work
- "What's at risk?" - Identify at-risk items

**Just click any chip** and the AI will respond instantly!

### Custom Queries

Type your own questions in the "Ask me anything..." input box:

**Example Questions:**
```
What decisions need my attention?
Show me all overdue tasks
Which tasks are blocking other work?
Who should I follow up with about the website redesign?
Summarize all pending decisions for the marketing team
What's at risk of missing deadlines this week?
```

**Press Enter** to send your message.

---

## Features & Tips

### Chat History
- All messages persist during your session
- Scroll up to review previous responses
- Continue multi-turn conversations

### Action Execution
Ask the AI to perform actions:

```
Create a decision about choosing a CRM platform
Update the website redesign task to in_progress
Send a reminder about the budget approval decision
```

The AI will execute the action and confirm completion.

### Context-Aware Responses
The assistant knows about:
- All your current decisions
- All your tasks
- Your role and permissions
- Voting status and deadlines
- Blockers and dependencies

Responses are personalized to **your** workspace.

### Smart Follow-ups
After receiving an answer, ask follow-up questions:

```
You: What's blocking me?
AI: [Shows 3 blocked tasks]
You: Tell me more about the API integration task
AI: [Provides detailed analysis]
```

---

## Use Cases

### 1. Morning Standup Prep
```
Query: "What should I focus on today?"

AI Response:
- 2 urgent tasks need attention
- Budget approval decision awaits your vote
- Website redesign task is blocking 3 others
- Recommendation: Vote on budget first, then tackle API integration
```

### 2. Workflow Optimization
```
Query: "Identify all blockers in my workflow"

AI Response:
- Task "API Integration" is blocking 3 tasks
- Decision "CRM Platform" is stalled (no votes in 48h)
- Task "Database Migration" waiting on external vendor
- Recommendation: Send reminder for CRM decision
```

### 3. Team Coordination
```
Query: "Who should I follow up with?"

AI Response:
- John - hasn't voted on budget decision (due tomorrow)
- Sarah - API integration task overdue by 2 days
- Marketing team - needs input on website redesign decision
- Recommendation: Send reminder to John first (highest priority)
```

### 4. Risk Management
```
Query: "What's at risk?"

AI Response:
- Budget decision at risk (50% voted, deadline in 24h)
- 5 tasks overdue this week
- Website launch decision has high AI risk score
- Recommendation: Extend budget deadline or send urgent reminder
```

### 5. Progress Summaries
```
Query: "Summarize pending items"

AI Response:
You have:
- 3 decisions in voting (1 urgent)
- 12 active tasks (5 assigned to you)
- 2 overdue items

Highlights:
- Budget approval needs 2 more votes
- API integration blocking 3 downstream tasks
- Q1 planning decision ready for finalization

Recommendations:
1. Vote on budget decision (urgent)
2. Update API integration status
3. Review and finalize Q1 planning
```

---

## Keyboard Shortcuts

- **Enter**: Send message
- **Shift + Enter**: New line (multi-line messages)
- **Escape**: Close assistant (future enhancement)

---

## Mobile Usage

On mobile devices, the assistant opens in **full-screen mode** for better usability.

**Touch Gestures:**
- Tap quick action chip to send query
- Swipe to scroll through messages
- Tap input field to open keyboard
- Tap X button to close assistant

---

## Best Practices

### 1. Be Specific
Instead of: "What's going on?"
Try: "What decisions need my vote today?"

### 2. Use Quick Actions First
Start with quick actions to understand the AI's capabilities, then move to custom queries.

### 3. Ask Follow-ups
Don't start over - continue the conversation:
```
You: What's blocking me?
AI: [Shows blockers]
You: Focus on the API integration task
AI: [Detailed analysis]
You: Who's assigned to that?
AI: [Shows assignee and suggests action]
```

### 4. Request Actions
Use imperative commands:
```
"Create a decision about..."
"Update task X to..."
"Send reminder for..."
```

### 5. Regular Check-ins
Make it part of your daily routine:
- Morning: "What should I work on today?"
- Midday: "What needs my attention?"
- Evening: "Summarize what I accomplished"

---

## Troubleshooting

### "Please add your Gemini API key" Error

**Solution:** Add your API key in Settings > API Keys > Gemini API Key

### Assistant Won't Open

**Check:**
1. Are you on the Decisions & Tasks page?
2. Is your user account logged in?
3. Try refreshing the page
4. Check browser console for errors

### No AI Responses

**Check:**
1. Is your Gemini API key valid?
2. Do you have internet connection?
3. Have you exceeded API quota? (check Google AI Studio)
4. Try a simpler query first

### Incorrect or Generic Responses

**Try:**
1. Be more specific in your query
2. Include context (task names, decision titles)
3. Use quick actions for best results
4. Check that you have decisions/tasks in your workspace

### Styling Issues

**Fix:**
1. Clear browser cache
2. Refresh the page
3. Try incognito/private mode
4. Report to support if persistent

---

## Privacy & Security

### What Data is Shared?

When you use the AI Assistant, the following data is sent to Google Gemini:
- Your query text
- Decision titles and statuses
- Task titles and statuses
- Basic metadata (dates, priorities, vote counts)

**NOT shared:**
- Your API key (stays local)
- Sensitive personal information
- Financial data
- Passwords or credentials

### Data Storage

- Chat history stored in browser memory (cleared on refresh)
- No server-side storage of conversations
- API key stored in localStorage (encrypted)
- Queries logged by Google per their privacy policy

### Best Practices

- Don't include sensitive information in queries
- Use generic terms for confidential projects
- Review Google's [Gemini API Privacy Policy](https://ai.google.dev/terms)
- Rotate API keys periodically

---

## FAQ

**Q: Is the AI Assistant free?**
A: Yes, with the free Gemini API tier (60 requests/minute). Heavy users may need a paid plan.

**Q: Can it create decisions and tasks?**
A: Yes! Just ask: "Create a decision about X" or "Create a task for Y"

**Q: Does chat history persist?**
A: Currently, history clears on page refresh. Persistence coming in a future update.

**Q: Can I use it on mobile?**
A: Yes! The assistant is fully responsive and opens full-screen on mobile.

**Q: What languages are supported?**
A: English is primary, but Gemini supports 100+ languages. Try asking in your language!

**Q: Can I customize quick actions?**
A: Not yet, but custom quick actions are planned for a future update.

**Q: How accurate are the AI responses?**
A: Very accurate for factual data (your decisions/tasks). Recommendations are suggestions, not guarantees.

**Q: Can I export chat history?**
A: Not currently, but export functionality is planned for a future release.

---

## Getting Help

### In-App
- Click the help icon in settings
- Check tooltips and hints
- Review documentation links

### Support Channels
- GitHub Issues: [Pulse Issues](https://github.com/yourrepo/pulse/issues)
- Email: support@pulse.app
- Discord: [Pulse Community](https://discord.gg/pulse)

### Report a Bug
Include:
1. What you were trying to do
2. What happened vs. what you expected
3. Your browser and OS version
4. Screenshot or error message
5. Steps to reproduce

---

## Advanced Tips

### Power User Queries

**Batch Operations:**
```
Show me all decisions created this week that need my vote
List overdue tasks assigned to the engineering team
Find all high-priority tasks with no assignee
```

**Comparative Analysis:**
```
Compare my task completion rate this month vs last month
Show me which decisions took longest to resolve
Identify my most productive days this week
```

**Trend Detection:**
```
Are decisions taking longer to resolve lately?
Am I falling behind on tasks?
Which team members are most active?
```

**Complex Workflows:**
```
What needs to happen before we can launch the product?
Show me the critical path for the website redesign
Identify dependencies between my tasks
```

---

## What's Next?

### Coming Soon
- Chat history persistence
- Voice input support
- Suggested follow-up questions
- Bookmarkable insights
- Multi-turn conversation context

### Future Enhancements
- Integration with Slack and email
- Custom AI agent training
- Proactive suggestions
- Analytics on assistant usage
- Team collaboration features

---

## Success Stories

### Example: Sarah (Product Manager)
> "The AI Assistant saves me 30 minutes every morning. Instead of scrolling through decisions and tasks, I just ask 'What needs my attention?' and get a prioritized list instantly."

### Example: Mike (Engineering Lead)
> "Identifying blockers used to take forever. Now I just ask 'What's blocking my team?' and the AI shows me exactly what to focus on."

### Example: Lisa (Marketing Director)
> "I use it for daily standups. 'Summarize pending items' gives me a perfect overview to share with my team in seconds."

---

## Feedback Welcome!

We're constantly improving the AI Assistant. Share your feedback:

- What features do you love?
- What's missing or confusing?
- What queries would you like to ask?
- How can we make it more helpful?

**Send feedback:** feedback@pulse.app or use the in-app feedback button.

---

## Quick Reference Card

**Most Used Commands:**
1. `What needs my attention?` - Daily priority check
2. `What's blocking me?` - Identify blockers
3. `Summarize pending items` - Quick overview
4. `What should I work on next?` - Get recommendations
5. `Who should I follow up with?` - Coordination help

**Keyboard Shortcuts:**
- Enter: Send
- Shift+Enter: New line

**Opening:** Decisions & Tasks > AI Assistant button

**Setup:** Settings > API Keys > Gemini API Key

---

**Ready to boost your productivity? Open the AI Assistant now! 🚀**
