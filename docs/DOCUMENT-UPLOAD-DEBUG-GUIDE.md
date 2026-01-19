# 🔍 Document Upload Debugging Guide

## The Problem

You mentioned: *"The AI still says it can't find the context files"*

This means one of these steps is failing:
1. File upload to database ❌
2. Embedding generation ❌
3. Vector search ❌
4. Context inclusion in prompt ❌

## New Debug System

I've added **comprehensive console logging** to track exactly where the problem is.

---

## Step-by-Step Debugging

### 1. Open Developer Console
- Press `F12` or `Ctrl+Shift+I` (Windows)
- Or `Cmd+Option+I` (Mac)
- Click the **Console** tab

### 2. Upload a Test File

Create a simple test file (`test.txt`):
```
Pulse is a team collaboration platform.
It helps organizations track projects and relationships.
Key features include CRM integration and AI-powered insights.
```

### 3. Watch the Console

You should see this sequence:

```javascript
📤 Starting file upload, number of files: 1
📄 Processing file: test.txt Size: 156 bytes
✅ File read complete: test.txt Content length: 156
🚀 Starting ingestion for: test.txt
   User ID: abc-123-def-456
   Project ID: null (or xyz-789...)
   API Key present: true

// After ~5-10 seconds:
✅ Ingestion complete: {id: "...", title: "test.txt", ...}
   Document ID: doc-123-abc
   Summary: "Pulse is a collaboration platform for tracking..."
   Keywords: ["collaboration", "CRM", "AI", "projects"]
```

### 4. Identify Where It Breaks

#### ❌ If you see ERROR at File Read:
```javascript
❌ FileReader error: [error details]
```
**Problem**: Browser can't read the file  
**Fix**: Check file format (should be .txt, .md, or .json)

#### ❌ If you see ERROR at Ingestion:
```javascript
❌ Ingestion failed: Error: [details]
```
**Problem**: Database insert or API call failed  
**Fix**: Check:
- Is `VITE_SUPABASE_URL` set?
- Is `VITE_SUPABASE_ANON_KEY` set?
- Is `VITE_GEMINI_API_KEY` set?

#### ❌ If ingestion completes but NO Summary/Keywords:
```javascript
✅ Ingestion complete: {...}
   Document ID: doc-123-abc
   Summary: undefined
   Keywords: undefined
```
**Problem**: Gemini API calls failing  
**Fix**: Check Gemini API key and quota

#### ✅ If everything succeeds:
```javascript
✅ Ingestion complete: {...}
   Document ID: doc-123-abc
   Summary: "..."
   Keywords: [...]
```
**Great!** Document is uploaded. Now test search...

---

### 5. Test AI Search

After successful upload, ask a question:

**Your message**: "What is Pulse?"

Watch console during AI response:

```javascript
// In handleSendMessage:
📊 Searching for similar docs...
📚 Found 1 relevant source(s)

// Should show toast:
"Found 1 relevant source(s) 📚"

// Then AI response should cite:
"📚 Sources: test.txt"
```

#### ❌ If AI doesn't mention the document:
Add this debug line to `handleSendMessage` (around line 170):

```typescript
const similarDocs = await ragService.searchSimilar(...);
console.log('🔍 Similar docs found:', similarDocs);
console.log('🔍 Number of chunks:', similarDocs.length);
```

This will show if vector search is working.

---

## Manual Verification in Supabase

### Check Documents Table
1. Go to Supabase Dashboard
2. Navigate to **Table Editor** → `knowledge_docs`
3. You should see your uploaded file
4. Check these columns:
   - `is_processed`: should be `true`
   - `processing_status`: should be `'completed'`
   - `ai_summary`: should have text
   - `ai_keywords`: should be array of strings

### Check Embeddings Table
1. Navigate to **Table Editor** → `doc_embeddings`
2. Filter by your `doc_id`
3. Should see **multiple rows** (chunks)
4. Each row should have:
   - `content`: text chunk
   - `embedding`: array of 768 numbers
   - `chunk_index`: 0, 1, 2, ...

### Check Vector Search Function
Run this in **SQL Editor**:

```sql
-- Test vector search (replace with actual embedding)
SELECT 
  de.content,
  kd.title,
  1 - (de.embedding <=> '[0.1, 0.2, ...]'::vector) as similarity
FROM doc_embeddings de
JOIN knowledge_docs kd ON de.doc_id = kd.id
ORDER BY similarity DESC
LIMIT 5;
```

---

## Common Issues & Fixes

### Issue 1: "API Key present: false"
**Cause**: Gemini API key not set  
**Fix**: 
```bash
# In .env file:
VITE_GEMINI_API_KEY=your_key_here
```

### Issue 2: "Processing status stuck on 'processing'"
**Cause**: Gemini API timeout or error  
**Fix**: Check browser console for API errors

### Issue 3: "No embeddings in database"
**Cause**: 
- Gemini embedding API failed
- Rate limit hit
- RLS policy blocking insert

**Fix**: 
- Check console for "Error saving embeddings"
- Verify `006_fix_embeddings_rls.sql` was run
- Check Gemini API quota

### Issue 4: "Search returns empty"
**Cause**:
- No embeddings generated
- Query embedding generation failed
- Similarity threshold too high

**Fix**:
```typescript
// In ragService.searchSimilar, change:
match_threshold: 0.5  // Try 0.3 for more results
```

### Issue 5: "Context not included in AI prompt"
**Cause**: `similarDocs.length === 0`

**Debug**:
```typescript
// Add in handleSendMessage after searchSimilar:
console.log('📊 Documents in database:', documents.length);
console.log('📊 Similar docs found:', similarDocs.length);
console.log('📊 Context being sent:', context);
```

---

## Expected Console Output (Success)

```javascript
// 1. Upload
📤 Starting file upload, number of files: 1
📄 Processing file: my-doc.txt Size: 523 bytes
✅ File read complete: my-doc.txt Content length: 523
🚀 Starting ingestion for: my-doc.txt
   User ID: user-abc-123
   Project ID: null
   API Key present: true

// 2. Processing (5-10 seconds)
⏳ Generating embeddings...

// 3. Complete
✅ Ingestion complete: {id: "...", ...}
   Document ID: 4f5c6b7e-89ab-cdef-0123-456789abcdef
   Summary: "This document discusses project management..."
   Keywords: ["project", "management", "team", "agile"]

// 4. UI Update
Toast: "✅ my-doc.txt indexed with AI summary!"

// 5. Query (after asking question)
📊 Searching for similar docs...
🔍 Similar docs found: [{doc_title: "my-doc.txt", similarity: 0.87, ...}]
📚 Found 1 relevant source(s)
Toast: "Found 1 relevant source(s) 📚"

// 6. AI Response
"Based on the document 'my-doc.txt', ..."
📚 Sources: my-doc.txt
```

---

## Still Not Working?

### Last Resort Debugging

Add this **temporary code** to `LiveDashboard.tsx` in `handleSendMessage`:

```typescript
// After line: const similarDocs = await ragService.searchSimilar(...)

console.log('=== FULL DEBUG ===');
console.log('User question:', userMessage);
console.log('Documents in state:', documents);
console.log('Documents passed to search:', documents.length);
console.log('Similar docs returned:', similarDocs);
console.log('Context built:', context);
console.log('Full prompt being sent:', fullPrompt);
console.log('=================');
```

This will show you **exactly** what the AI is seeing.

If context is empty, the problem is in vector search.  
If context is populated but AI ignores it, the problem is in the prompt.

---

## Contact Points

If you share your console output showing the debug logs, I can pinpoint exactly where the issue is:

1. 📤 Upload starts
2. ✅ File reads
3. 🚀 Ingestion begins
4. ✅ Ingestion completes (with doc ID)
5. 📊 Search executes
6. 🔍 Results found
7. 📚 Context added to prompt

One of these steps will fail or return empty - that's where we fix it!

---

**Next Steps**:
1. Open DevTools Console
2. Upload a file
3. Copy/paste the console output
4. Share with me so I can diagnose the exact issue
