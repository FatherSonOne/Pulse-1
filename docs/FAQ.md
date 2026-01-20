# Pulse Messages - Frequently Asked Questions

**Version**: 1.0
**Last Updated**: 2026-01-19

---

## General Questions

### What is Pulse Messages?

Pulse Messages is a comprehensive, AI-powered messaging platform that combines real-time chat, AI assistance, CRM integration, and productivity tools in a unified interface.

### What platforms does Pulse Messages support?

- **Web**: All modern browsers (Chrome, Firefox, Safari, Edge)
- **Desktop**: Windows, macOS, Linux (via web)
- **Mobile**: iOS and Android (responsive web app)
- **Progressive Web App**: Install on any device

### Is my data secure?

Yes. All data is:
- Encrypted in transit (TLS 1.3)
- Encrypted at rest (AES-256)
- Stored on secure Supabase infrastructure
- Subject to row-level security policies
- Backed up daily

---

## Features

### How do I add reactions to messages?

**Desktop**: Hover over any message for 300ms and click an emoji from the reaction bar.

**Mobile**: Long-press a message for 500ms and tap an emoji.

**Alternative**: Right-click (or tap three dots) and select "Add Reaction."

### What are the AI tools?

Pulse includes 9 AI tools:
- AI Coach - Personalized guidance
- AI Mediator - Conflict resolution
- Smart Compose - Message suggestions
- Sentiment Analysis - Tone detection
- Voice Context - Voice intelligence
- Translation - Multi-language support
- Brainstorm Assistant - Idea generation
- Conversation Intelligence - Insights
- Deep Reasoner - Complex problem solving

### How does Focus Mode work?

Focus Mode helps you concentrate by:
1. Hiding distractions (sidebars, notifications)
2. Running a Pomodoro timer (25 min default)
3. Showing only the active conversation
4. Providing a summary when done

Start with the crosshairs icon in the top toolbar.

### Can I schedule messages?

Yes. Click the clock icon when composing a message, select date/time, and the message will send automatically at that time.

---

## Technical Questions

### What keyboard shortcuts are available?

See the [Keyboard Shortcuts](./KEYBOARD_SHORTCUTS.md) guide for a complete list.

Most common:
- `Ctrl/Cmd + Enter` - Send message
- `Ctrl/Cmd + ]` or `[` - Navigate threads
- `Ctrl/Cmd + J` - Jump to search
- `?` - Show shortcuts help

### How do I search messages?

1. Click the search box (top-left)
2. Type your query
3. Press Enter or Ctrl+J

Advanced: Use filters for date, sender, or message type.

### Can I export my messages?

Yes. Use the Analytics Export tool:
1. Open Tools Panel
2. Select "Analytics Export"
3. Choose format (CSV, JSON, PDF)
4. Click Export

### How do real-time updates work?

Pulse uses WebSocket connections via Supabase Realtime:
- New messages appear instantly
- Reactions update in real-time
- Typing indicators show live
- No page refresh needed

---

## Integration Questions

### What CRM platforms are supported?

- HubSpot
- Salesforce
- Pipedrive
- Zoho CRM

Connect via Settings > Integrations > CRM.

### How do I link messages to CRM contacts?

1. Right-click a message
2. Select "Link to CRM"
3. Choose platform and contact
4. Message is linked automatically

### Can I import contacts from Gmail?

Yes. Go to Settings > Integrations > Gmail and authorize access. Contacts sync automatically.

---

## Performance Questions

### Why is the app slow?

Common causes:
- Large thread with 1000+ messages
- Many open threads
- Slow internet connection
- Browser cache needs clearing

Solutions:
- Reload the page
- Clear browser cache
- Close unused threads
- Use Focus Mode
- Check internet speed

### How much data does Pulse use?

Typical usage:
- Text messages: ~1-5 KB each
- Images: ~100-500 KB each
- Voice messages: ~50-100 KB/minute
- Real-time updates: ~10 KB/hour

### Does Pulse work offline?

Limited offline support:
- View previously loaded messages
- Draft new messages (sent when online)
- Search cached conversations

Full offline mode coming soon.

---

## Account & Billing

### How do I change my profile?

1. Click avatar (top-right)
2. Select "Profile"
3. Edit name, avatar, status
4. Click Save

### What's included in the free tier?

- Unlimited messages
- Basic AI features (limited)
- 5 GB file storage
- 10 CRM integrations
- Standard support

### What do I get with Pro?

- Advanced AI tools (Vision Lab, Video Studio, etc.)
- Unlimited AI usage
- 100 GB file storage
- Unlimited CRM integrations
- Priority support
- Custom integrations
- Team features

### How do I upgrade to Pro?

1. Click avatar > Billing
2. Select "Pro" plan
3. Enter payment details
4. Confirm purchase

---

## Troubleshooting

### Messages not sending

1. Check internet connection
2. Verify not rate-limited
3. Try refreshing page
4. Clear browser cache
5. Contact support if persists

### Reactions not working

1. Update to latest browser version
2. Clear browser cache
3. Disable browser extensions
4. Try incognito mode
5. Report bug if continues

### Focus Mode won't start

1. Refresh the page
2. Clear localStorage
3. Select a thread first
4. Check browser console for errors

### Search not finding messages

1. Verify spelling
2. Try different keywords
3. Use filters (date, sender)
4. Check thread isn't archived
5. Rebuild search index (Settings)

---

## Privacy & Security

### Who can see my messages?

Only:
- Members of the channel/thread
- Workspace administrators (if applicable)
- You (message author)

Messages are private by default.

### Can I delete messages permanently?

Yes. Deleted messages are:
- Removed from UI immediately
- Soft-deleted in database (30 days)
- Hard-deleted after 30 days
- Irrecoverable after hard delete

### How is AI data used?

- Processed by Google Gemini API
- Not used to train Google models
- Not shared with third parties
- Stored temporarily for caching
- Deleted after processing

### Can I opt out of AI features?

Yes. Go to Settings > Privacy > AI Features and toggle off. Messages will not be processed by AI.

---

## Best Practices

### How do I organize conversations?

- **Pin** important threads
- **Star** key messages
- **Archive** completed threads
- **Mute** low-priority threads
- **Use** search and filters

### What's the best way to use Focus Mode?

1. **Plan** your focus session
2. **Set** realistic duration (25 min)
3. **Eliminate** external distractions
4. **Take** breaks between sessions
5. **Review** focus digest after

### How can I improve AI suggestions?

- Provide clear context in messages
- Use complete sentences
- Be specific about intent
- Review and rate suggestions
- Train with feedback

---

## Getting Help

### Where can I find documentation?

- [User Guide](./USER_GUIDE.md) - Feature walkthroughs
- [Keyboard Shortcuts](./KEYBOARD_SHORTCUTS.md) - All shortcuts
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues
- [API Reference](./API_REFERENCE.md) - Developer docs

### How do I contact support?

- **Email**: support@pulse.example.com
- **Chat**: Click "Help" in bottom-right
- **Community**: community.pulse.example.com
- **Twitter**: @PulseApp

### How do I report a bug?

1. Click "Help" > "Report Bug"
2. Describe the issue
3. Include steps to reproduce
4. Attach screenshots if relevant
5. Submit report

### Is there a community forum?

Yes! Visit community.pulse.example.com to:
- Ask questions
- Share tips
- Request features
- Connect with users

---

**Still have questions?** Contact us at support@pulse.example.com

---

**Document Version**: 1.0
**Last Updated**: 2026-01-19
