# 🔧 RAG Context Not Working - Complete Debug Guide

## The Problem

**User reports**: AI says "I cannot directly access or view files" even after uploading documents.

**Root Cause**: One of these is failing:
1. ❌ Documents not uploading correctly
2. ❌ Embeddings not generating
3. ❌ Vector search returning no results
4. ❌ Context not being included in prompt
5. ❌ AI ignoring the provided context

---

## New Enhanced Debugging (Just Added)

I've added **comprehensive logging** at every step. Here's what you'll see:

### Step 1: Document Search
```javascript
🔍 Starting document search...
   Documents available: 3
   Document titles: ["test.txt", "notes.md", "data.json"]
   User question: Can you see the uploaded files?
```

### Step 2: Search Execution
```javascript
🔍 searchSimilar called with:
   Query: Can you see the uploaded files?
   User ID: abc-123-def
   Project ID: null

✅ Query embedding generated: 768 dimensions

📊 Database RPC result:
   Error: null
   Data: [{doc_title: "test.txt", content: "...", similarity: 0.85}, ...]
   Results count: 3
```

### Step 3: Context Building
```javascript
🔍 Search complete!
   Similar docs found: 3
   Similar docs: [...]

✅ Context built:
   Length: 1250
   Citations: ["test.txt", "notes.md"]
   Preview: "📚 IMPORTANT: You have access to..."
```

### Step 4: Prompt Construction
```javascript
📤 Sending to AI:
   Prompt length: 1850
   Has context: true
   Full prompt preview: "You are a helpful AI assistant with access..."
```

### Step 5: AI Response
```javascript
📥 AI Response received:
   Length: 342
   Preview: "Based on the uploaded files..."
```

---

## What to Check When AI Can't See Files

### Check 1: Are Documents Actually Uploaded?

**In Console**:
```javascript
// After upload, you should see:
✅ Ingestion complete: {id: "...", title: "test.txt", ...}
   Document ID: abc-123-def
   Summary: "This document discusses..."
   Keywords: ["test", "example", "data"]
```

**In Supabase**:
```sql
SELECT id, title, is_processed, processing_status 
FROM knowledge_docs 
ORDER BY created_at DESC 
LIMIT 5;
```

Expected: `is_processed = true`, `processing_status = 'completed'`

### Check 2: Are Embeddings Created?

**In Console**:
```javascript
// During upload, you should see:
🔮 Creating embeddings... (60-80%)
💾 Saving to database... (80-95%)
```

**In Supabase**:
```sql
SELECT 
  kd.title,
  COUNT(de.id) as embedding_count
FROM knowledge_docs kd
LEFT JOIN doc_embeddings de ON kd.id = de.doc_id
GROUP BY kd.id, kd.title
ORDER BY kd.created_at DESC;
```

Expected: `embedding_count > 0` (should be 10-50 depending on document size)

### Check 3: Does Vector Search Return Results?

**In Console (after asking question)**:
```javascript
🔍 Starting document search...
   Documents available: 3  // Should match your uploads
   
🔍 Search complete!
   Similar docs found: 3   // Should be > 0 if embeddings exist
```

**Manual Test in Supabase**:
```sql
-- Check if match_documents function exists
SELECT * FROM pg_proc WHERE proname = 'match_documents';

-- Test with dummy embedding (if function exists)
SELECT * FROM match_documents(
  query_embedding := '[0.1, 0.2, ..., 0.1]'::vector,  -- 768 numbers
  match_threshold := 0.3,
  match_count := 5,
  filter_user_id := NULL
);
```

### Check 4: Is Context Being Passed?

**In Console**:
```javascript
✅ Context built:
   Length: 1250           // Should be > 100
   Citations: ["test.txt"]  // Should list your files
```

If Length is 0, context is empty → search failed.

### Check 5: Is AI Using the Context?

**In Console**:
```javascript
📤 Sending to AI:
   Has context: true      // Must be true
   Full prompt preview: "📚 IMPORTANT: You have access..."
```

The prompt now includes:
- Clear instruction to use sources
- Numbered sources with titles
- Explicit command to cite sources
- Warning not to make things up

---

## Expected Console Output (Full Success)

```javascript
// 1. User asks question
🔍 Starting document search...
   Documents available: 2
   Document titles: ["test.txt", "notes.md"]
   User question: Can you see the uploaded files?

// 2. Search executes
🔍 searchSimilar called with:
   Query: Can you see the uploaded files?
   User ID: user-123
   Project ID: null

✅ Query embedding generated: 768 dimensions

📊 Database RPC result:
   Error: null
   Data: [{doc_title: "test.txt", ...}, {doc_title: "notes.md", ...}]
   Results count: 2

🔍 Search complete!
   Similar docs found: 2
   Similar docs: [Object, Object]

// 3. Context builds
✅ Context built:
   Length: 850
   Citations: ["test.txt", "notes.md"]
   Preview: "📚 IMPORTANT: You have access to the following documents..."

// 4. Toast notification
Toast: "Found 2 relevant source(s) 📚"

// 5. Prompt sent
📤 Sending to AI:
   Prompt length: 1450
   Has context: true
   Full prompt preview: "You are a helpful AI assistant with access..."

// 6. Response received
📥 AI Response received:
   Length: 280
   Preview: "Yes, I can see the uploaded files. According to test.txt..."

// 7. UI updates
📚 Sources: test.txt, notes.md
```

---

## Common Failure Patterns

### Pattern 1: No Embeddings
```javascript
✅ Ingestion complete: {id: "...", ...}
   Document ID: abc-123
   Summary: "..."
   Keywords: ["..."]

// But later:
📊 Database RPC result:
   Data: []
   Results count: 0  ← NO RESULTS
```

**Cause**: Embeddings table is empty  
**Fix**: 
1. Check Gemini API key
2. Check API quota
3. Re-run migration `006_fix_embeddings_rls.sql`
4. Re-upload document

### Pattern 2: Search Fails
```javascript
🔍 Starting document search...
   Documents available: 2  ← Documents exist

🔍 Search complete!
   Similar docs found: 0  ← But no matches
```

**Cause**: 
- Similarity threshold too high (0.5)
- Query embedding failed
- Wrong user_id filter

**Fix**:
```typescript
// In ragService.ts, try lowering threshold:
match_threshold: 0.3  // Instead of 0.5
```

### Pattern 3: Context Empty
```javascript
✅ Context built:
   Length: 0  ← EMPTY
   Citations: []
```

**Cause**: `similarDocs.length === 0`  
**Fix**: See Pattern 1 & 2

### Pattern 4: AI Ignores Context
```javascript
📤 Sending to AI:
   Has context: true
   
📥 AI Response received:
   "As a large language model, I cannot access files..."
```

**Cause**: Old Gemini model ignoring instructions or context too long  
**Fix**:
- Try `gemini-2.0-flash-exp` (already in use)
- Shorten context (reduce chunks)
- Try different system prompt

---

## Immediate Actions to Take

### Action 1: Open Console and Upload File
1. F12 → Console tab
2. Upload `test.txt` with simple content
3. Copy entire console output
4. Look for these markers: 📤 📄 ✅ 🚀 📊

### Action 2: Check Supabase Tables
```sql
-- 1. Check documents
SELECT * FROM knowledge_docs ORDER BY created_at DESC LIMIT 5;

-- 2. Check embeddings
SELECT doc_id, COUNT(*) FROM doc_embeddings GROUP BY doc_id;

-- 3. Check if RLS is blocking
SET ROLE authenticated;
SELECT * FROM doc_embeddings LIMIT 1;
```

### Action 3: Ask Question and Watch Console
1. Ask: "Can you see the uploaded files?"
2. Watch for 🔍 markers
3. Check if "Similar docs found" > 0
4. Check if "Context built" length > 0

### Action 4: Share Console Output
Copy the entire console output and share it - I can pinpoint exactly where it's failing.

---

## The Enhanced Prompt (New)

The AI now receives this structure:

```
You are a helpful AI assistant with access to a knowledge base.

📚 IMPORTANT: You have access to the following documents from the knowledge base. You MUST reference and cite these sources when answering the user's question.

### SOURCE 1: test.txt (Similarity: 87.5%)

[Document content here...]

---

### SOURCE 2: notes.md (Similarity: 82.3%)

[Document content here...]

---

IMPORTANT INSTRUCTIONS:
- Base your answer PRIMARILY on the provided sources above
- Explicitly mention which source you're referencing (e.g., "According to test.txt...")
- If the sources don't contain the answer, say so clearly
- Do not make up information not present in the sources

USER QUESTION: Can you see the uploaded files?

YOUR RESPONSE:
```

This makes it **much harder** for the AI to ignore the context!

---

## Success Criteria

You'll know it's working when:
- ✅ Console shows "Similar docs found: N" (N > 0)
- ✅ Console shows "Context built: Length: X" (X > 100)
- ✅ Toast says "Found N relevant source(s)"
- ✅ AI response mentions document names
- ✅ Citations appear below AI message
- ✅ AI says things like "According to test.txt..."

---

**Next Steps**: Upload a file, ask a question, and share the complete console output. The new logging will show us exactly where it's breaking!
