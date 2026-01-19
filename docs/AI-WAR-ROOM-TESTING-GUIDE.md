# 🧪 AI War Room - Quick Testing Guide

## Step 1: Apply Database Migration
Copy and paste the entire contents of `supabase/migrations/007_war_room_enhancements.sql` into your Supabase SQL Editor and run it.

**Expected Result**: All tables created with no errors.

---

## Step 2: Test War Room Creation
1. Navigate to Live AI section in Pulse
2. Click "New" button under WAR ROOMS
3. Enter name: "Test Strategy"
4. Click checkmark

**Expected Result**: 
- ✅ Toast: "War Room created! 🎯"
- New war room appears in list
- Color badge visible

---

## Step 3: Test Document Upload with AI Processing
1. Create a test file (`test-doc.txt`):
```
Pulse is a team collaboration platform that helps organizations 
track projects, manage relationships, and visualize impact. 
It features real-time dashboards, CRM integration, and AI-powered 
insights. The platform is built with React, TypeScript, and Supabase.
Key features include: contact management, event tracking, donation 
processing, map visualization, and now AI-powered document analysis.
```

2. Click "Upload" button in header
3. Select your test file
4. Watch the toast progress

**Expected Result**:
- ✅ Toast: "Processing test-doc.txt..."
- ✅ After ~5-10 seconds: "✅ test-doc.txt indexed with AI summary!"
- Document appears in Knowledge Base button badge (count increases)

---

## Step 4: Verify AI Summary & Keywords
1. Click "Knowledge Base" button in sidebar
2. Find your uploaded document
3. Look for the purple "AI Summary" box
4. Look for pink keyword tags below

**Expected Result**:
- Summary: 2-3 sentences about Pulse platform
- Keywords: Tags like `#collaboration`, `#React`, `#AI`, `#CRM`, etc.
- Status badge: Green "completed"

---

## Step 5: Test Session with Deep Thinking
1. Click "New" under SESSIONS
2. Enter title: "Test Deep Thinking"
3. Click checkmark
4. **Enable "Deep Thinking" toggle** in header
5. Type question: "What is Pulse and what does it do?"
6. Press Enter

**Expected Result**:
- ✅ Message sent
- ✅ Toast: "Found 1 relevant source(s) 📚"
- ✅ AI responds with information from your document
- ✅ Blue citation badge appears: "📚 Sources: test-doc.txt"
- ✅ Small text below AI message: "AI Thinking Process (5 steps)"

---

## Step 6: Expand AI Thinking Log
1. Click the "AI Thinking Process (5 steps)" link

**Expected Result**:
- ✅ Expands to show 5 steps:
  - Step 1: "Analyzing user query..."
  - Step 2: "Searching 1 documents..."
  - Step 3: "Found 1 relevant document chunks: test-doc.txt"
  - Step 4: "Formulating response as general persona..."
  - Step 5: "Generated XXX character response"
- Each step shows duration in milliseconds

---

## Step 7: Test Context Indicators
1. Look above the input box
2. Should see: "🧠 Context:" followed by document badges

**Expected Result**:
- ✅ Green badge with checkmark: "✓ test-doc.txt"
- Badge has green border (completed processing)

---

## Step 8: Test Prompt Suggestions
1. Send 2-3 more messages in the session
2. Wait ~5 seconds after last AI response
3. Look for "SUGGESTED PROMPTS" bar above input

**Expected Result**:
- ✅ Bar appears with 3 suggested follow-up questions
- ✅ Click one → auto-fills input
- ✅ Suggestion disappears from bar

---

## Step 9: Test Agent Personas
1. Select "🤔 Skeptic" from agent dropdown
2. Ask: "Is Pulse better than other CRM tools?"
3. Observe response tone

**Expected Result**:
- ✅ AI responds with critical questioning
- ✅ Points out potential flaws or assumptions
- ✅ More analytical/challenging tone

---

## Step 10: Test Project Filtering
1. Click "All Projects" in War Rooms section
2. Upload a new document
3. Switch to your "Test Strategy" war room
4. Check if document appears

**Expected Result**:
- ✅ Document only appears when "All Projects" selected
- ✅ Switching to specific war room filters documents
- ✅ Sessions also filtered by project

---

## Step 11: Test Quick Start Cards (Empty Session)
1. Create new session
2. Before typing anything, look at the center area

**Expected Result**:
- ✅ 4 colorful cards:
  - "Explore Capabilities"
  - "Brainstorm"
  - "Upload Documents"
  - "Analyze Documents"
- ✅ Click "Analyze Documents" → auto-fills input
- ✅ Knowledge Base summary shown if docs exist

---

## Step 12: Test Audio Overview
1. Have a session with 3+ messages
2. Click "Audio" button in header
3. Wait for generation

**Expected Result**:
- ✅ Button shows "Generating..."
- ✅ Toast: "Audio overview ready! 🎧"
- ✅ Audio player appears at bottom
- ✅ Can play audio summary

---

## 🐛 Common Issues & Fixes

### Issue: "Key is not present in table 'users'"
**Fix**: Run `supabase/migrations/005_fix_user_sync.sql` first

### Issue: "new row violates row-level security policy"
**Fix**: Run `supabase/migrations/006_fix_embeddings_rls.sql` first

### Issue: "Model not found" (404)
**Fix**: Already handled - using `gemini-2.0-flash-exp` model

### Issue: Document shows "pending" forever
**Check**:
- Browser console for errors
- Gemini API key is valid
- Network tab for failed API calls

### Issue: No thinking log appears
**Check**:
- "Deep Thinking" toggle is enabled (brain icon)
- Wait for full AI response to complete
- Check browser console for errors

### Issue: No prompt suggestions
**Check**:
- Session has at least 2 messages
- Wait 5+ seconds after AI response
- Check Supabase logs for generation errors

---

## ✅ Success Criteria

If all tests pass, you should see:
- ✅ War rooms create and organize sessions/docs
- ✅ Documents processed with AI summaries + keywords
- ✅ Citations appear on AI responses
- ✅ Thinking logs show AI reasoning (when enabled)
- ✅ Context indicators show active documents
- ✅ Prompt suggestions auto-generate
- ✅ Agent personas change response style
- ✅ All CRUD operations work (create, read, update, delete)
- ✅ UI is polished with gradients, badges, icons

---

## 📊 Performance Benchmarks

Expected timings:
- **Document upload**: 5-15 seconds (depends on size)
- **AI response**: 2-5 seconds
- **Prompt suggestions**: Generated in background (~3-5 seconds)
- **Audio overview**: 10-20 seconds
- **Thinking log**: Adds ~500ms total overhead

---

## 🎯 What Makes This Special

After testing, you should notice:
1. **No context switching** - Everything in one place
2. **AI transparency** - You see what it's thinking
3. **Smart organization** - Projects keep things clean
4. **Proactive help** - Suggestions guide you
5. **Visual feedback** - Always know what's happening
6. **Document intelligence** - AI knows your content

---

**Ready to test?** Start with Step 1 and work through sequentially! 🚀
