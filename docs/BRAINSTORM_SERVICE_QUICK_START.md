# Brainstorm Service Quick Start Guide

Quick reference for using the AI-powered brainstorming service in Pulse.

---

## Prerequisites

### API Keys Required
Set these in localStorage (via Settings UI):

```javascript
localStorage.setItem('gemini_api_key', 'your-gemini-key');
localStorage.setItem('openai_api_key', 'your-openai-key');
localStorage.setItem('anthropic_api_key', 'your-claude-key');
```

At minimum, you need **one** of these keys. The service will work with any single provider, though some functions prefer specific models.

---

## Basic Usage

### 1. Create a Session

```typescript
import { createBrainstormSession } from '@/services/brainstormService';

const session = await createBrainstormSession('Product Roadmap 2026', 'free_form');
// Frameworks: 'scamper' | 'six_hats' | 'free_form'
```

### 2. Add Ideas

```typescript
session.ideas.push({
  id: `idea-${Date.now()}`,
  text: 'Implement real-time collaboration features',
  votes: 0,
  tags: ['collaboration', 'feature'],
  createdAt: new Date()
});
```

### 3. Use AI Features

```typescript
import {
  autoClusterIdeas,
  expandIdea,
  generateVariations,
  synthesizeIdeas,
  findGaps,
  checkSimilarity,
  scamperGenerate,
  sixHatsGenerate
} from '@/services/brainstormService';

// Auto-cluster ideas
const clusters = await autoClusterIdeas(session.ideas, 4);

// Expand a single idea
const expansion = await expandIdea(session.ideas[0], session.topic);

// Generate creative variations
const variations = await generateVariations(session.ideas[0], session.topic);

// Combine top ideas
const topIdeas = session.ideas.slice(0, 5);
const syntheses = await synthesizeIdeas(topIdeas, session.topic);

// Find missing perspectives
const gaps = await findGaps(session.topic, session.ideas);

// Check for duplicates
const similar = await checkSimilarity('New idea text', session.ideas);

// SCAMPER ideation
const scamperIdeas = await scamperGenerate(session.topic, 'substitute', session.ideas);

// Six Hats perspectives
const hatIdeas = await sixHatsGenerate(session.topic, 'green', session.ideas);
```

### 4. Save Session

```typescript
import { saveBrainstormSession } from '@/services/brainstormService';

await saveBrainstormSession(session);
```

### 5. Load Session

```typescript
import { loadBrainstormSession, listBrainstormSessions } from '@/services/brainstormService';

// Load specific session
const session = await loadBrainstormSession('session-id');

// List all user's sessions
const sessions = await listBrainstormSessions();
```

### 6. Export Results

```typescript
import { exportBrainstorm } from '@/services/brainstormService';

// Export as mindmap (Mermaid.js)
const mindmap = exportBrainstorm(session, { format: 'mindmap' });

// Export as presentation (HTML)
const presentation = exportBrainstorm(session, {
  format: 'presentation',
  includeVotes: true,
  includeClusters: true
});

// Export as markdown
const markdown = exportBrainstorm(session, {
  format: 'markdown',
  includeVotes: true
});

// Export as JSON
const json = exportBrainstorm(session, { format: 'json' });
```

---

## Function Reference

### Core AI Functions

| Function | Provider | Speed | Cost | Use Case |
|----------|----------|-------|------|----------|
| `autoClusterIdeas()` | Gemini Flash | Fast | Low | Group ideas by theme |
| `expandIdea()` | GPT-4o | Medium | Medium | Detailed analysis |
| `generateVariations()` | Gemini Flash | Fast | Low | Creative alternatives |
| `synthesizeIdeas()` | Claude Sonnet 4 | Slow | High | Combine ideas |
| `findGaps()` | Claude Sonnet 4 | Slow | High | Gap analysis |
| `scoreSynthesis()` | Claude Sonnet 4 | Medium | Medium | Evaluate quality |
| `checkSimilarity()` | Embeddings | Very Fast | Very Low | Find duplicates |
| `findConnections()` | Embeddings + AI | Medium | Medium | Discover links |
| `scamperGenerate()` | Gemini Flash | Fast | Low | SCAMPER technique |
| `sixHatsGenerate()` | GPT-4o | Medium | Medium | Six Hats technique |

### Session Management

```typescript
// Create
createBrainstormSession(topic: string, framework?: string): Promise<BrainstormSession | null>

// Save
saveBrainstormSession(session: BrainstormSession): Promise<boolean>

// Load
loadBrainstormSession(sessionId: string): Promise<BrainstormSession | null>

// List
listBrainstormSessions(): Promise<BrainstormSession[]>

// Delete
deleteBrainstormSession(sessionId: string): Promise<boolean>
```

---

## Common Patterns

### Pattern 1: Rapid Ideation
```typescript
// Start with SCAMPER to generate diverse ideas
const techniques = ['substitute', 'combine', 'adapt', 'modify', 'put_to_use', 'eliminate', 'reverse'];
for (const technique of techniques) {
  const ideas = await scamperGenerate(topic, technique, session.ideas);
  session.ideas.push(...ideas);
}

// Then cluster to organize
const clusters = await autoClusterIdeas(session.ideas, 5);
```

### Pattern 2: Deep Analysis
```typescript
// Expand top voted idea
const topIdea = session.ideas.sort((a, b) => b.votes - a.votes)[0];
const expansion = await expandIdea(topIdea, session.topic);

// Generate variations
const variations = await generateVariations(topIdea, session.topic);

// Check for gaps
const gaps = await findGaps(session.topic, session.ideas);
```

### Pattern 3: Quality Check
```typescript
// Find duplicates before adding
const similar = await checkSimilarity(newIdeaText, session.ideas, 0.75);
if (similar.length === 0) {
  // Idea is unique, add it
  session.ideas.push(newIdea);
}

// Score synthesis quality
const syntheses = await synthesizeIdeas(topIdeas, session.topic);
for (const synthesis of syntheses) {
  const score = await scoreSynthesis(synthesis, session.topic);
  if (score.overall >= 70) {
    // High quality synthesis
  }
}
```

### Pattern 4: Collaborative Brainstorming
```typescript
// Add collaborators
session.collaborators = ['user-id-1', 'user-id-2'];
await saveBrainstormSession(session);

// Find connections between different contributors' ideas
const connections = await findConnections(session.ideas, 0.6);
```

---

## Error Handling

All functions handle errors gracefully:

```typescript
try {
  const clusters = await autoClusterIdeas(ideas, 4);
  if (clusters.length === 0) {
    // No clusters generated (could be too few ideas)
    console.log('Not enough ideas to cluster');
  }
} catch (error) {
  // API error or network issue
  console.error('Clustering failed:', error);
  // Service returns safe defaults on error
}
```

**Automatic Retry:**
- 3 retry attempts with exponential backoff
- 1s, 2s, 4s delays
- Graceful fallback on failure

---

## Caching

Caching is automatic and transparent:

```typescript
// First call: Hits API (~2s)
const expansion1 = await expandIdea(idea, topic);

// Second call with same inputs: Cache hit (<50ms)
const expansion2 = await expandIdea(idea, topic);
```

**Cache Duration:** 24 hours

**Cache Keys Based On:**
- Operation type
- Input content (hashed)
- Parameters (e.g., numClusters)

**Manual Cache Clear:**
```typescript
// Clear all caches (not exposed, but available in service internals)
// aiCache.clear();
```

---

## Performance Tips

### Optimize API Calls
```typescript
// Bad: Sequential calls
for (const idea of ideas) {
  await expandIdea(idea, topic); // Slow!
}

// Good: Parallel calls (when appropriate)
const expansions = await Promise.all(
  ideas.slice(0, 3).map(idea => expandIdea(idea, topic))
);
```

### Reduce Costs
```typescript
// Use fast/cheap operations first
const clusters = await autoClusterIdeas(ideas, 4); // Fast, cheap

// Then use expensive operations only on top ideas
const topCluster = clusters[0];
const clusterIdeas = ideas.filter(i => clusters[0].ideaIds.includes(i.id));
const synthesis = await synthesizeIdeas(clusterIdeas, topic); // Slow, expensive
```

### Leverage Caching
```typescript
// Cache-friendly: Reuse same inputs
const clusters1 = await autoClusterIdeas(ideas, 4); // Cache miss
const clusters2 = await autoClusterIdeas(ideas, 4); // Cache hit!

// Cache-unfriendly: Changing inputs
const clusters3 = await autoClusterIdeas(ideas.slice(0, 5), 4); // Cache miss
```

---

## Testing

### Mock AI Responses
```typescript
import { vi } from 'vitest';
import * as geminiService from '@/services/geminiService';

vi.spyOn(geminiService, 'processWithModel').mockResolvedValue(
  JSON.stringify({
    clusters: [
      { name: 'Test Cluster', theme: 'Test theme', ideaIds: ['1'], confidence: 0.9 }
    ]
  })
);

const clusters = await autoClusterIdeas(ideas, 2);
expect(clusters).toHaveLength(1);
```

### Integration Tests
```typescript
// Mark as slow test
it('should cluster ideas with real API', async () => {
  const ideas = [/* real ideas */];
  const clusters = await autoClusterIdeas(ideas, 3);
  expect(clusters.length).toBeGreaterThan(0);
}, { timeout: 10000 });
```

---

## Troubleshooting

### "API key not configured"
```typescript
// Check localStorage
console.log(localStorage.getItem('gemini_api_key'));

// Set key
localStorage.setItem('gemini_api_key', 'your-key-here');
```

### "No response from AI"
- Check API key validity
- Check network connection
- Verify API quota/billing
- Check browser console for detailed errors

### Empty Results
- Too few ideas (need at least 2-3 for clustering)
- Ideas too similar (clustering may combine)
- Network timeout (increase timeout)

### Slow Performance
- Large number of ideas (>50 can be slow)
- Sequential calls instead of parallel
- Cache not being utilized
- Slow model (GPT-4o, Claude slower than Gemini)

---

## Best Practices

1. **Start Small:** Test with 3-5 ideas before scaling up
2. **Use Caching:** Avoid changing inputs unnecessarily
3. **Batch Operations:** Combine related API calls
4. **Handle Errors:** Always check for null/empty returns
5. **Save Often:** Auto-save sessions to prevent data loss
6. **Provide Context:** Include relevant topic/framework information
7. **Check Duplicates:** Use `checkSimilarity()` before adding ideas
8. **Validate Quality:** Score syntheses before presenting to users

---

## Examples

### Complete Brainstorming Session
```typescript
import {
  createBrainstormSession,
  scamperGenerate,
  autoClusterIdeas,
  findGaps,
  synthesizeIdeas,
  scoreSynthesis,
  exportBrainstorm,
  saveBrainstormSession
} from '@/services/brainstormService';

async function runBrainstormSession() {
  // 1. Create session
  const session = await createBrainstormSession(
    'Improving Customer Onboarding',
    'scamper'
  );

  // 2. Generate initial ideas using SCAMPER
  const techniques = ['substitute', 'combine', 'eliminate'];
  for (const technique of techniques) {
    const ideas = await scamperGenerate(session.topic, technique, session.ideas);
    session.ideas.push(...ideas);
  }

  // 3. Cluster ideas
  const clusters = await autoClusterIdeas(session.ideas, 3);
  session.clusters = clusters.map((c, i) => ({
    id: `cluster-${i}`,
    name: c.name,
    color: ['#667eea', '#764ba2', '#f093fb'][i],
    ideaIds: c.ideaIds,
    theme: c.theme,
    aiGenerated: true
  }));

  // 4. Update idea cluster assignments
  session.ideas.forEach(idea => {
    const cluster = session.clusters.find(c => c.ideaIds.includes(idea.id));
    if (cluster) idea.clusterId = cluster.id;
  });

  // 5. Find gaps
  const gaps = await findGaps(session.topic, session.ideas);
  console.log('Missing perspectives:', gaps.missingPerspectives);

  // Add gap-filling ideas
  session.ideas.push(...gaps.suggestedIdeas);

  // 6. Synthesize top ideas
  const topIdeas = session.ideas
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 5);
  const syntheses = await synthesizeIdeas(topIdeas, session.topic);

  // 7. Score syntheses
  for (const synthesis of syntheses) {
    const score = await scoreSynthesis(synthesis, session.topic);
    console.log(`${synthesis.name}: ${score.overall}/100`);
  }

  // 8. Export presentation
  const presentation = exportBrainstorm(session, {
    format: 'presentation',
    includeVotes: true,
    includeClusters: true
  });

  // 9. Save session
  await saveBrainstormSession(session);

  return { session, syntheses, presentation };
}
```

---

## Support

For issues or questions:
- Check logs in browser console
- Review this guide
- See full documentation: `docs/BRAINSTORM_SERVICE_IMPLEMENTATION.md`
- File issue in project repository

---

**Version:** 1.0
**Last Updated:** January 19, 2026
