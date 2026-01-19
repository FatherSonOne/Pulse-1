/**
 * Brainstorm Service
 * Backend-ready functions for AI-powered brainstorming features
 *
 * AI-powered brainstorming with multi-provider support:
 * - Gemini 2.5 Flash: Fast clustering, variations, SCAMPER
 * - GPT-4o: Detailed expansions, Six Hats perspectives
 * - Claude Sonnet 4: Synthesis, gap analysis, quality scoring
 * - OpenAI Embeddings: Similarity detection, connections
 */

import { supabase } from './supabase';
import { processWithModel, generateEmbedding } from './geminiService';
import { generateOpenAIResponse } from './openAiService';
import { generateClaudeResponse } from './anthropicService';

// ============================================
// Utility Functions
// ============================================

/**
 * Simple hash function for cache keys
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * AI Cache Manager - stores AI results to reduce API calls
 */
class AICache {
  private cache = new Map<string, { result: any; expires: number }>();
  private ttl = 24 * 60 * 60 * 1000; // 24 hours

  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.result;
  }

  async set(key: string, result: any): Promise<void> {
    this.cache.set(key, {
      result,
      expires: Date.now() + this.ttl
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

const aiCache = new AICache();

/**
 * Retry wrapper with exponential backoff
 */
async function withAIRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (attempt === maxRetries - 1) throw error;

      // Exponential backoff: 1s, 2s, 4s
      await new Promise(resolve =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt))
      );
    }
  }
  throw new Error('All retries exhausted');
}

/**
 * Get API key from localStorage with fallback
 */
function getAPIKey(provider: 'gemini' | 'openai' | 'claude'): string {
  const keyMap = {
    gemini: 'gemini_api_key',
    openai: 'openai_api_key',
    claude: 'anthropic_api_key'
  };

  const key = localStorage.getItem(keyMap[provider]);
  if (!key) {
    throw new Error(`${provider} API key not configured. Please set it in Settings.`);
  }
  return key;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================
// Types
// ============================================

export interface BrainstormIdea {
  id: string;
  text: string;
  votes: number;
  tags: string[];
  clusterId?: string;
  color?: string;
  createdAt: Date;
  createdBy?: string;
  expanded?: string;
  connections?: string[];
  priority?: 'low' | 'medium' | 'high';
  status?: 'new' | 'discussed' | 'selected' | 'rejected';
  aiGenerated?: boolean;
  confidence?: number;
}

export interface BrainstormCluster {
  id: string;
  name: string;
  color: string;
  icon?: string;
  ideaIds: string[];
  aiGenerated?: boolean;
  theme?: string;
  summary?: string;
}

export interface BrainstormSession {
  id: string;
  topic: string;
  framework?: string;
  ideas: BrainstormIdea[];
  clusters: BrainstormCluster[];
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  collaborators?: string[];
}

export interface ClusterSuggestion {
  name: string;
  theme: string;
  ideaIds: string[];
  confidence: number;
}

export interface GapAnalysisResult {
  missingPerspectives: string[];
  suggestedIdeas: BrainstormIdea[];
  blindSpots: string[];
}

export interface IdeaExpansion {
  description: string;
  benefits: string[];
  challenges: string[];
  nextSteps: string[];
}

export interface IdeaVariation {
  type: 'simplified' | 'amplified' | 'combined' | 'opposite' | 'alternative';
  text: string;
  rationale: string;
}

export interface SynthesisResult {
  name: string;
  description: string;
  combinedIdeas: string[];
  uniqueValue: string;
}

export interface SynthesisScore {
  overall: number; // 0-100
  feasibility: number; // 0-100
  impact: number; // 0-100
  innovation: number; // 0-100
  alignment: number; // 0-100 (alignment with topic)
  rationale: string;
  strengths: string[];
  weaknesses: string[];
}

export interface IdeaConnection {
  idea1Id: string;
  idea2Id: string;
  connectionType: 'complement' | 'conflict' | 'dependency' | 'similarity' | 'synergy';
  explanation: string;
  strength: number; // 0-1
}

// ============================================
// Session Management
// ============================================

/**
 * Create a new brainstorm session
 */
export async function createBrainstormSession(
  topic: string,
  framework?: string
): Promise<BrainstormSession | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const now = new Date();
    const sessionData = {
      topic,
      framework,
      ideas: [],
      clusters: [],
      owner_id: user.id,
      collaborators: [],
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };

    const { data, error } = await supabase
      .from('brainstorm_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating session:', error);
      return null;
    }

    // Transform database response to BrainstormSession
    return {
      id: data.id,
      topic: data.topic,
      framework: data.framework,
      ideas: data.ideas || [],
      clusters: data.clusters || [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      ownerId: data.owner_id,
      collaborators: data.collaborators || []
    };
  } catch (error) {
    console.error('Error creating brainstorm session:', error);
    return null;
  }
}

/**
 * Save brainstorm session state
 */
export async function saveBrainstormSession(
  session: BrainstormSession
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('brainstorm_sessions')
      .update({
        topic: session.topic,
        framework: session.framework,
        ideas: session.ideas,
        clusters: session.clusters,
        collaborators: session.collaborators || [],
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id);

    if (error) {
      console.error('Supabase error saving session:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error saving brainstorm session:', error);
    return false;
  }
}

/**
 * Load brainstorm session
 */
export async function loadBrainstormSession(
  sessionId: string
): Promise<BrainstormSession | null> {
  try {
    const { data, error } = await supabase
      .from('brainstorm_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      console.error('Supabase error loading session:', error);
      return null;
    }

    if (!data) return null;

    // Transform database response to BrainstormSession
    return {
      id: data.id,
      topic: data.topic,
      framework: data.framework,
      ideas: data.ideas || [],
      clusters: data.clusters || [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      ownerId: data.owner_id,
      collaborators: data.collaborators || []
    };
  } catch (error) {
    console.error('Error loading brainstorm session:', error);
    return null;
  }
}

/**
 * List all brainstorm sessions for the current user
 */
export async function listBrainstormSessions(): Promise<BrainstormSession[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('brainstorm_sessions')
      .select('*')
      .or(`owner_id.eq.${user.id},collaborators.cs.{${user.id}}`)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Supabase error listing sessions:', error);
      return [];
    }

    if (!data) return [];

    return data.map(row => ({
      id: row.id,
      topic: row.topic,
      framework: row.framework,
      ideas: row.ideas || [],
      clusters: row.clusters || [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      ownerId: row.owner_id,
      collaborators: row.collaborators || []
    }));
  } catch (error) {
    console.error('Error listing brainstorm sessions:', error);
    return [];
  }
}

/**
 * Delete a brainstorm session
 */
export async function deleteBrainstormSession(sessionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('brainstorm_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      console.error('Supabase error deleting session:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting brainstorm session:', error);
    return false;
  }
}

// ============================================
// AI-Powered Features (Backend Hooks)
// ============================================

/**
 * Auto-cluster ideas using AI
 * Analyzes idea content and groups them by themes
 *
 * @param ideas - Array of ideas to cluster
 * @param numClusters - Suggested number of clusters (3-5 recommended)
 * @returns Array of cluster suggestions with confidence scores
 */
export async function autoClusterIdeas(
  ideas: BrainstormIdea[],
  numClusters: number = 4
): Promise<ClusterSuggestion[]> {
  if (ideas.length === 0) return [];
  if (ideas.length < numClusters) {
    numClusters = Math.max(2, Math.floor(ideas.length / 2));
  }

  // Check cache
  const cacheKey = `cluster-${hashString(JSON.stringify(ideas.map(i => i.id)))}-${numClusters}`;
  const cached = await aiCache.get(cacheKey);
  if (cached) return cached;

  const apiKey = getAPIKey('gemini');

  const prompt = `Analyze these ${ideas.length} brainstorming ideas and group them into ${numClusters} thematic clusters.

Ideas:
${ideas.map((idea, idx) => `[${idea.id}] ${idea.text}`).join('\n')}

For each cluster, provide:
1. A concise, descriptive name (2-4 words)
2. A theme description explaining the common pattern
3. The idea IDs that belong to this cluster
4. A confidence score (0.0 to 1.0) indicating how well these ideas fit together

Return ONLY valid JSON in this exact format:
{
  "clusters": [
    {
      "name": "Cluster Name",
      "theme": "Description of the common theme",
      "ideaIds": ["id1", "id2"],
      "confidence": 0.85
    }
  ]
}`;

  try {
    const response = await withAIRetry(async () => {
      const result = await processWithModel(apiKey, prompt, 'gemini-2.5-flash');
      if (!result) throw new Error('No response from AI');
      return result;
    });

    // Parse JSON response
    let jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    const clusters: ClusterSuggestion[] = parsed.clusters || [];

    // Cache result
    await aiCache.set(cacheKey, clusters);

    return clusters;
  } catch (error) {
    console.error('Auto-clustering error:', error);
    return [];
  }
}

/**
 * Find gaps and missing perspectives in brainstorm using Claude Sonnet 4
 * Identifies blind spots and suggests ideas to fill coverage gaps
 *
 * @param topic - The brainstorm topic
 * @param ideas - Current ideas
 * @returns Gap analysis with suggestions
 */
export async function findGaps(
  topic: string,
  ideas: BrainstormIdea[]
): Promise<GapAnalysisResult> {
  if (ideas.length === 0) {
    return {
      missingPerspectives: ['No ideas yet - start brainstorming!'],
      suggestedIdeas: [],
      blindSpots: []
    };
  }

  // Check cache
  const cacheKey = `gaps-${hashString(topic)}-${hashString(JSON.stringify(ideas.map(i => i.id)))}`;
  const cached = await aiCache.get(cacheKey);
  if (cached) return cached;

  const apiKey = getAPIKey('claude');

  const prompt = `You are an expert facilitator analyzing a brainstorming session for coverage gaps.

Topic: ${topic}

Current ideas (${ideas.length} total):
${ideas.map((idea, idx) => `${idx + 1}. ${idea.text}`).join('\n')}

Perform a comprehensive gap analysis:

1. MISSING PERSPECTIVES:
   - Which stakeholder viewpoints are underrepresented? (users, partners, competitors, regulators, etc.)
   - What use cases or scenarios haven't been considered?
   - Which dimensions are missing? (technical, business, social, environmental, etc.)
   - What time horizons are neglected? (short-term, long-term, future trends)

2. BLIND SPOTS:
   - What assumptions might be limiting the thinking?
   - What risks or concerns are being overlooked?
   - What alternative approaches aren't being considered?
   - What constraints or opportunities are missing from the discussion?

3. SUGGESTED IDEAS (3-5 specific ideas):
   - Generate concrete ideas that fill the identified gaps
   - Each should address a different missing perspective
   - Make them actionable and relevant to the topic
   - Ensure they complement (not duplicate) existing ideas

Return ONLY valid JSON in this exact format:
{
  "missingPerspectives": [
    "Customer experience perspective missing",
    "No ideas about scalability or growth"
  ],
  "blindSpots": [
    "Assuming unlimited budget - no cost considerations",
    "Not considering regulatory compliance"
  ],
  "suggestedIdeas": [
    {
      "id": "gap-1",
      "text": "Specific idea to fill gap 1...",
      "votes": 0,
      "tags": ["gap-fill"],
      "aiGenerated": true,
      "confidence": 0.85,
      "createdAt": "${new Date().toISOString()}"
    }
  ]
}`;

  try {
    const response = await withAIRetry(async () => {
      const result = await generateClaudeResponse(apiKey, prompt, 'claude-sonnet-4-20250514');
      if (!result) throw new Error('No response from AI');
      return result;
    });

    // Parse JSON response
    let jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    // Transform suggested ideas to proper format
    const suggestedIdeas: BrainstormIdea[] = (parsed.suggestedIdeas || []).map((idea: any) => ({
      ...idea,
      createdAt: new Date(idea.createdAt || Date.now())
    }));

    const result: GapAnalysisResult = {
      missingPerspectives: parsed.missingPerspectives || [],
      blindSpots: parsed.blindSpots || [],
      suggestedIdeas
    };

    // Cache result
    await aiCache.set(cacheKey, result);

    return result;
  } catch (error) {
    console.error('Gap analysis error:', error);
    return {
      missingPerspectives: [],
      blindSpots: [],
      suggestedIdeas: []
    };
  }
}

/**
 * Expand a single idea with details using STAR framework
 * (Situation, Task, Action, Result)
 *
 * @param idea - The idea to expand
 * @param topic - Context topic
 * @returns Detailed expansion
 */
export async function expandIdea(
  idea: BrainstormIdea,
  topic: string
): Promise<IdeaExpansion> {
  // Check cache
  const cacheKey = `expand-${idea.id}-${hashString(topic)}`;
  const cached = await aiCache.get(cacheKey);
  if (cached) return cached;

  const apiKey = getAPIKey('openai');

  const prompt = `Expand on this brainstorming idea with actionable details using the STAR framework:

Topic: ${topic}
Idea: ${idea.text}

Provide a comprehensive expansion with:

1. DESCRIPTION (2-3 paragraphs):
   - How would this idea work in practice?
   - What is the implementation approach?
   - What resources or systems would be needed?

2. BENEFITS (3-5 specific points):
   - What are the concrete advantages?
   - What measurable outcomes would we see?
   - Who benefits and how?

3. CHALLENGES (2-3 realistic points):
   - What obstacles might we encounter?
   - What are the potential risks?
   - Include mitigation strategies for each challenge

4. NEXT STEPS (3-4 actionable items):
   - Specific, concrete actions to start implementing
   - Prioritized by what should happen first
   - Include who should be involved and rough timeline

Return ONLY valid JSON in this exact format:
{
  "description": "Detailed multi-paragraph description...",
  "benefits": ["Benefit 1 with specific outcome", "Benefit 2..."],
  "challenges": ["Challenge 1 with mitigation strategy", "Challenge 2..."],
  "nextSteps": ["Step 1 with timeline", "Step 2..."]
}`;

  try {
    const response = await withAIRetry(async () => {
      const result = await generateOpenAIResponse(apiKey, prompt, 'gpt-4o');
      if (!result) throw new Error('No response from AI');
      return result;
    });

    // Parse JSON response
    let jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
    const expansion: IdeaExpansion = JSON.parse(jsonStr);

    // Cache result
    await aiCache.set(cacheKey, expansion);

    return expansion;
  } catch (error) {
    console.error('Idea expansion error:', error);
    return {
      description: 'Unable to expand idea at this time.',
      benefits: [],
      challenges: [],
      nextSteps: []
    };
  }
}

/**
 * Generate variations of an idea using creative transformation techniques
 *
 * @param idea - Source idea
 * @param topic - Context topic
 * @returns Array of idea variations
 */
export async function generateVariations(
  idea: BrainstormIdea,
  topic: string
): Promise<IdeaVariation[]> {
  // Check cache
  const cacheKey = `variations-${idea.id}-${hashString(topic)}`;
  const cached = await aiCache.get(cacheKey);
  if (cached) return cached;

  const apiKey = getAPIKey('gemini');

  const prompt = `Generate 5 creative variations of this brainstorming idea using different transformation techniques:

Topic: ${topic}
Original Idea: ${idea.text}

Create the following variations:

1. SIMPLIFIED: Strip the idea down to its bare essentials
   - What is the minimal viable version?
   - Remove all complexity and nice-to-haves

2. AMPLIFIED: Take the idea to its extreme or maximum scale
   - What if we had unlimited resources?
   - Push boundaries and think 10x bigger

3. COMBINED: Merge this idea with a complementary concept
   - What related idea could enhance this?
   - Create synergy through combination

4. OPPOSITE: Reverse or invert the approach
   - What if we did the exact opposite?
   - Challenge core assumptions

5. ALTERNATIVE: Find a different path to achieve the same goal
   - What's another way to get similar results?
   - Use different methods or technologies

For each variation, explain the rationale and how it differs from the original.

Return ONLY valid JSON in this exact format:
{
  "variations": [
    {
      "type": "simplified",
      "text": "The variation idea text...",
      "rationale": "Why this variation is interesting..."
    }
  ]
}`;

  try {
    const response = await withAIRetry(async () => {
      const result = await processWithModel(apiKey, prompt, 'gemini-2.5-flash');
      if (!result) throw new Error('No response from AI');
      return result;
    });

    // Parse JSON response
    let jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    const variations: IdeaVariation[] = parsed.variations || [];

    // Cache result
    await aiCache.set(cacheKey, variations);

    return variations;
  } catch (error) {
    console.error('Variation generation error:', error);
    return [];
  }
}

/**
 * Synthesize top ideas into cohesive concepts using Claude Sonnet 4
 * Combines multiple ideas into powerful unified concepts
 *
 * @param ideas - Top ideas to synthesize (3-8 recommended)
 * @param topic - Context topic
 * @returns Array of synthesized concepts
 */
export async function synthesizeIdeas(
  ideas: BrainstormIdea[],
  topic: string
): Promise<SynthesisResult[]> {
  if (ideas.length < 2) return [];

  // Check cache
  const cacheKey = `synthesize-${hashString(JSON.stringify(ideas.map(i => i.id)))}-${hashString(topic)}`;
  const cached = await aiCache.get(cacheKey);
  if (cached) return cached;

  const apiKey = getAPIKey('claude');

  const prompt = `You are a strategic innovation consultant. Combine these brainstorming ideas into 2-3 powerful, cohesive concepts.

Topic: ${topic}

Ideas to synthesize:
${ideas.map((idea, idx) => `${idx + 1}. ${idea.text} (ID: ${idea.id})`).join('\n')}

For each synthesis, create:

1. NAME: A catchy, memorable name for the combined concept (3-6 words)
   - Should be inspiring and easy to remember
   - Captures the essence of the combination

2. DESCRIPTION: How these ideas combine synergistically (2-3 paragraphs)
   - Explain the core concept
   - Show how combining these ideas creates something greater than the sum of parts
   - Describe the practical implementation

3. COMBINED IDEAS: List which idea IDs are part of this synthesis

4. UNIQUE VALUE: What makes this combination uniquely powerful?
   - Why is this synthesis better than pursuing ideas individually?
   - What new capabilities or benefits emerge from the combination?
   - What problems does this solve that individual ideas don't address?

Create 2-3 distinct syntheses that each represent different strategic directions.

Return ONLY valid JSON in this exact format:
{
  "syntheses": [
    {
      "name": "Synthesis Name",
      "description": "Detailed description...",
      "combinedIdeas": ["id1", "id2", "id3"],
      "uniqueValue": "What makes this uniquely powerful..."
    }
  ]
}`;

  try {
    const response = await withAIRetry(async () => {
      const result = await generateClaudeResponse(apiKey, prompt, 'claude-sonnet-4-20250514');
      if (!result) throw new Error('No response from AI');
      return result;
    });

    // Parse JSON response
    let jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    const syntheses: SynthesisResult[] = parsed.syntheses || [];

    // Cache result
    await aiCache.set(cacheKey, syntheses);

    return syntheses;
  } catch (error) {
    console.error('Synthesis error:', error);
    return [];
  }
}

/**
 * Score a synthesis result using multi-factor AI assessment
 *
 * @param synthesis - The synthesis to score
 * @param topic - Original brainstorm topic
 * @returns Detailed scoring breakdown
 */
export async function scoreSynthesis(
  synthesis: SynthesisResult,
  topic: string
): Promise<SynthesisScore> {
  const cacheKey = `score-${hashString(synthesis.name)}-${hashString(topic)}`;
  const cached = await aiCache.get(cacheKey);
  if (cached) return cached;

  const apiKey = getAPIKey('claude');

  const prompt = `You are an innovation strategist evaluating a synthesized concept.

Topic: ${topic}

Synthesis to evaluate:
Name: ${synthesis.name}
Description: ${synthesis.description}
Unique Value: ${synthesis.uniqueValue}

Provide a comprehensive multi-factor assessment:

1. FEASIBILITY (0-100): How realistic is this to implement?
   - Consider resources, time, complexity, dependencies

2. IMPACT (0-100): How significant would the results be?
   - Consider scale of benefit, number of users affected, value created

3. INNOVATION (0-100): How novel and creative is this concept?
   - Consider uniqueness, differentiation, breakthrough potential

4. ALIGNMENT (0-100): How well does this fit the original topic?
   - Consider relevance, focus, strategic fit

5. OVERALL (0-100): Weighted average considering all factors

6. RATIONALE: 2-3 sentence explanation of the overall score

7. STRENGTHS: Top 3 strengths of this synthesis

8. WEAKNESSES: Top 2-3 weaknesses or concerns

Return ONLY valid JSON in this exact format:
{
  "overall": 85,
  "feasibility": 75,
  "impact": 90,
  "innovation": 88,
  "alignment": 85,
  "rationale": "Overall assessment...",
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "weaknesses": ["Weakness 1", "Weakness 2"]
}`;

  try {
    const response = await withAIRetry(async () => {
      const result = await generateClaudeResponse(apiKey, prompt, 'claude-sonnet-4-20250514');
      if (!result) throw new Error('No response from AI');
      return result;
    });

    let jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
    const score: SynthesisScore = JSON.parse(jsonStr);

    await aiCache.set(cacheKey, score);
    return score;
  } catch (error) {
    console.error('Synthesis scoring error:', error);
    return {
      overall: 50,
      feasibility: 50,
      impact: 50,
      innovation: 50,
      alignment: 50,
      rationale: 'Unable to score at this time',
      strengths: [],
      weaknesses: []
    };
  }
}

/**
 * Check for similar/duplicate ideas using embeddings
 * Uses OpenAI embeddings + cosine similarity
 *
 * @param newIdea - New idea text to check
 * @param existingIdeas - Existing ideas to compare against
 * @param threshold - Similarity threshold (0.0-1.0, default 0.75)
 * @returns Similar ideas if found, empty array if unique
 */
export async function checkSimilarity(
  newIdea: string,
  existingIdeas: BrainstormIdea[],
  threshold: number = 0.75
): Promise<BrainstormIdea[]> {
  if (!newIdea || existingIdeas.length === 0) return [];

  try {
    const apiKey = getAPIKey('gemini');

    // Generate embedding for new idea
    const newEmbedding = await generateEmbedding(apiKey, newIdea);
    if (!newEmbedding) return [];

    // Find similar ideas
    const similarities: Array<{ idea: BrainstormIdea; similarity: number }> = [];

    for (const idea of existingIdeas) {
      // Check cache for existing embeddings
      const embeddingCacheKey = `embedding-${idea.id}`;
      let ideaEmbedding = await aiCache.get(embeddingCacheKey);

      if (!ideaEmbedding) {
        ideaEmbedding = await generateEmbedding(apiKey, idea.text);
        if (ideaEmbedding) {
          await aiCache.set(embeddingCacheKey, ideaEmbedding);
        }
      }

      if (ideaEmbedding) {
        const similarity = cosineSimilarity(newEmbedding, ideaEmbedding);
        if (similarity >= threshold) {
          similarities.push({ idea, similarity });
        }
      }
    }

    // Sort by similarity (highest first)
    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities.map(s => s.idea);
  } catch (error) {
    console.error('Similarity check error:', error);
    return [];
  }
}

/**
 * Find connections between ideas using embeddings + AI explanation
 *
 * @param ideas - Ideas to analyze for connections
 * @param minStrength - Minimum connection strength (0.0-1.0, default 0.6)
 * @returns Array of discovered connections
 */
export async function findConnections(
  ideas: BrainstormIdea[],
  minStrength: number = 0.6
): Promise<IdeaConnection[]> {
  if (ideas.length < 2) return [];

  const cacheKey = `connections-${hashString(JSON.stringify(ideas.map(i => i.id)))}`;
  const cached = await aiCache.get(cacheKey);
  if (cached) return cached;

  try {
    const apiKey = getAPIKey('gemini');

    // Generate embeddings for all ideas
    const embeddings: Map<string, number[]> = new Map();

    for (const idea of ideas) {
      const embeddingCacheKey = `embedding-${idea.id}`;
      let embedding = await aiCache.get(embeddingCacheKey);

      if (!embedding) {
        embedding = await generateEmbedding(apiKey, idea.text);
        if (embedding) {
          await aiCache.set(embeddingCacheKey, embedding);
        }
      }

      if (embedding) {
        embeddings.set(idea.id, embedding);
      }
    }

    // Find pairs with high similarity
    const potentialConnections: Array<{ idea1: BrainstormIdea; idea2: BrainstormIdea; similarity: number }> = [];

    for (let i = 0; i < ideas.length; i++) {
      for (let j = i + 1; j < ideas.length; j++) {
        const emb1 = embeddings.get(ideas[i].id);
        const emb2 = embeddings.get(ideas[j].id);

        if (emb1 && emb2) {
          const similarity = cosineSimilarity(emb1, emb2);
          if (similarity >= minStrength) {
            potentialConnections.push({
              idea1: ideas[i],
              idea2: ideas[j],
              similarity
            });
          }
        }
      }
    }

    // Use AI to explain connections
    const connections: IdeaConnection[] = [];

    for (const { idea1, idea2, similarity } of potentialConnections.slice(0, 10)) {
      const prompt = `Analyze the relationship between these two ideas:

Idea 1: ${idea1.text}
Idea 2: ${idea2.text}

Determine:
1. Connection type: complement (work well together), conflict (contradict each other), dependency (one needs the other), similarity (very alike), synergy (create something new together)
2. Brief explanation of the connection (1-2 sentences)

Return ONLY valid JSON:
{
  "connectionType": "complement",
  "explanation": "Brief explanation..."
}`;

      try {
        const response = await processWithModel(apiKey, prompt, 'gemini-2.5-flash');
        if (response) {
          const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(jsonStr);

          connections.push({
            idea1Id: idea1.id,
            idea2Id: idea2.id,
            connectionType: parsed.connectionType,
            explanation: parsed.explanation,
            strength: similarity
          });
        }
      } catch (error) {
        console.error('Connection explanation error:', error);
      }
    }

    await aiCache.set(cacheKey, connections);
    return connections;
  } catch (error) {
    console.error('Find connections error:', error);
    return [];
  }
}

/**
 * Generate ideas using SCAMPER creative thinking technique
 * SCAMPER: Substitute, Combine, Adapt, Modify, Put to use, Eliminate, Reverse
 *
 * @param topic - Brainstorm topic
 * @param technique - SCAMPER technique to apply
 * @param existingIdeas - Current ideas for context
 * @returns Generated ideas following the technique
 */
export async function scamperGenerate(
  topic: string,
  technique: 'substitute' | 'combine' | 'adapt' | 'modify' | 'put_to_use' | 'eliminate' | 'reverse',
  existingIdeas: BrainstormIdea[]
): Promise<BrainstormIdea[]> {
  const cacheKey = `scamper-${technique}-${hashString(topic)}-${existingIdeas.length}`;
  const cached = await aiCache.get(cacheKey);
  if (cached) return cached;

  const apiKey = getAPIKey('gemini');

  const techniquePrompts = {
    substitute: {
      question: 'What can be SUBSTITUTED?',
      focus: 'What elements, materials, processes, people, or components could be replaced with something else? What alternatives exist?',
      examples: 'Replace physical meetings with virtual ones, substitute manual processes with automation, swap one technology for another'
    },
    combine: {
      question: 'What can be COMBINED?',
      focus: 'What ideas, features, or processes can be merged together? What can we unite or integrate to create something new?',
      examples: 'Merge two services into one platform, combine features to create new functionality, integrate separate workflows'
    },
    adapt: {
      question: 'What can be ADAPTED?',
      focus: 'What else is like this that we could adapt or copy? What ideas from other contexts could be modified to work here?',
      examples: 'Adapt successful patterns from other industries, copy nature\'s solutions, modify existing solutions from different domains'
    },
    modify: {
      question: 'What can be MODIFIED?',
      focus: 'What can be magnified, minimized, changed in scale, shape, or attributes? What if we alter time, speed, or intensity?',
      examples: 'Make it 10x bigger or smaller, speed up or slow down processes, change frequency or duration, alter appearance or format'
    },
    put_to_use: {
      question: 'How else can this be PUT TO USE?',
      focus: 'What are new ways to use this? What other applications exist? How could this serve different purposes or users?',
      examples: 'Repurpose existing tools for new uses, find new markets or audiences, apply solutions to different problems'
    },
    eliminate: {
      question: 'What can be ELIMINATED?',
      focus: 'What can be removed, reduced, or streamlined? What would happen if we take something away? How can we simplify?',
      examples: 'Remove unnecessary steps, eliminate complexity, reduce features to essentials, strip away non-core elements'
    },
    reverse: {
      question: 'What can be REVERSED?',
      focus: 'What if we did the opposite? Can we turn it inside out, upside down, or backwards? What if we reverse roles or sequences?',
      examples: 'Reverse the user flow, flip assumptions, invert the business model, turn problems into opportunities'
    }
  };

  const promptData = techniquePrompts[technique];
  const contextIdeas = existingIdeas.length > 0
    ? `\n\nExisting ideas for context:\n${existingIdeas.slice(0, 5).map((i, idx) => `${idx + 1}. ${i.text}`).join('\n')}`
    : '';

  const prompt = `Generate 3-5 innovative ideas using the SCAMPER ${technique.toUpperCase()} technique.

Topic: ${topic}

${promptData.question}

Focus: ${promptData.focus}

Examples of ${technique}: ${promptData.examples}${contextIdeas}

Generate creative, specific, and actionable ideas that apply this SCAMPER technique to the topic.
Make each idea distinct and practical. Consider both incremental and radical applications of the technique.

Return ONLY valid JSON in this exact format:
{
  "ideas": [
    {
      "id": "scamper-${technique}-1",
      "text": "Specific idea applying ${technique}...",
      "votes": 0,
      "tags": ["scamper", "${technique}"],
      "aiGenerated": true,
      "confidence": 0.8,
      "createdAt": "${new Date().toISOString()}"
    }
  ]
}`;

  try {
    const response = await withAIRetry(async () => {
      const result = await processWithModel(apiKey, prompt, 'gemini-2.5-flash');
      if (!result) throw new Error('No response from AI');
      return result;
    });

    let jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    const ideas: BrainstormIdea[] = (parsed.ideas || []).map((idea: any) => ({
      ...idea,
      createdAt: new Date(idea.createdAt || Date.now())
    }));

    await aiCache.set(cacheKey, ideas);
    return ideas;
  } catch (error) {
    console.error('SCAMPER generation error:', error);
    return [];
  }
}

/**
 * Generate ideas from Six Thinking Hats perspective
 * Uses GPT-4o for nuanced perspective-based thinking
 *
 * @param topic - Brainstorm topic
 * @param hat - Which thinking hat perspective to use
 * @param existingIdeas - Current ideas for context
 * @returns Generated ideas from that perspective
 */
export async function sixHatsGenerate(
  topic: string,
  hat: 'white' | 'red' | 'black' | 'yellow' | 'green' | 'blue',
  existingIdeas: BrainstormIdea[]
): Promise<BrainstormIdea[]> {
  const cacheKey = `sixhats-${hat}-${hashString(topic)}-${existingIdeas.length}`;
  const cached = await aiCache.get(cacheKey);
  if (cached) return cached;

  const apiKey = getAPIKey('openai');

  const hatPerspectives = {
    white: {
      name: 'White Hat - Facts & Information',
      focus: 'Objective data, facts, and information needs',
      questions: [
        'What facts do we know about this topic?',
        'What information is missing?',
        'What data do we need to gather?',
        'What are the measurable aspects?',
        'What research or evidence exists?'
      ],
      mindset: 'Be neutral and objective. Focus only on available information and data gaps. Avoid opinions or interpretations.'
    },
    red: {
      name: 'Red Hat - Emotions & Intuition',
      focus: 'Feelings, hunches, and gut reactions',
      questions: [
        'How do people feel about this?',
        'What is your gut reaction?',
        'What emotions does this evoke?',
        'What are the intuitive concerns or excitement?',
        'What do people\'s instincts say?'
      ],
      mindset: 'Express emotions freely without justification. Share gut feelings, hunches, and emotional responses to ideas.'
    },
    black: {
      name: 'Black Hat - Caution & Risks',
      focus: 'Potential problems, risks, and weaknesses',
      questions: [
        'What could go wrong?',
        'What are the weaknesses?',
        'What risks should we consider?',
        'Why might this not work?',
        'What obstacles will we face?'
      ],
      mindset: 'Be critical and cautious. Point out flaws, risks, and potential problems. Use logical negative judgment.'
    },
    yellow: {
      name: 'Yellow Hat - Benefits & Optimism',
      focus: 'Positive aspects, benefits, and opportunities',
      questions: [
        'What are the benefits?',
        'Why will this work?',
        'What opportunities exist?',
        'What\'s the best-case scenario?',
        'What value will this create?'
      ],
      mindset: 'Be optimistic and constructive. Look for benefits, value, and reasons why ideas will succeed.'
    },
    green: {
      name: 'Green Hat - Creativity & Alternatives',
      focus: 'New ideas, alternatives, and creative possibilities',
      questions: [
        'What if we tried something completely different?',
        'What are alternative approaches?',
        'How can we be more creative?',
        'What new possibilities exist?',
        'What haven\'t we thought of yet?'
      ],
      mindset: 'Think creatively and generate alternatives. Explore possibilities, provoke new ideas, use lateral thinking.'
    },
    blue: {
      name: 'Blue Hat - Process & Organization',
      focus: 'Process, organization, and next steps',
      questions: [
        'What\'s our process for this?',
        'How should we organize our thinking?',
        'What\'s the next step?',
        'What have we covered and what\'s missing?',
        'How do we move forward?'
      ],
      mindset: 'Focus on the thinking process itself. Organize ideas, define next steps, summarize progress, control the discussion.'
    }
  };

  const perspective = hatPerspectives[hat];
  const contextIdeas = existingIdeas.length > 0
    ? `\n\nExisting ideas to consider:\n${existingIdeas.slice(0, 5).map((i, idx) => `${idx + 1}. ${i.text}`).join('\n')}`
    : '';

  const prompt = `You are applying the Six Thinking Hats method to generate ideas.

Topic: ${topic}

Thinking Hat: ${perspective.name}

Focus: ${perspective.focus}

Key Questions:
${perspective.questions.map(q => `- ${q}`).join('\n')}

Mindset: ${perspective.mindset}${contextIdeas}

Generate 3-5 specific, actionable ideas from this ${hat} hat perspective.
Each idea should clearly reflect the ${hat} hat's focus and mindset.
Make ideas concrete and relevant to the topic.

Return ONLY valid JSON in this exact format:
{
  "ideas": [
    {
      "id": "hat-${hat}-1",
      "text": "Specific idea from ${hat} hat perspective...",
      "votes": 0,
      "tags": ["six-hats", "${hat}-hat"],
      "aiGenerated": true,
      "confidence": 0.85,
      "createdAt": "${new Date().toISOString()}"
    }
  ]
}`;

  try {
    const response = await withAIRetry(async () => {
      const result = await generateOpenAIResponse(apiKey, prompt, 'gpt-4o');
      if (!result) throw new Error('No response from AI');
      return result;
    });

    let jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    const ideas: BrainstormIdea[] = (parsed.ideas || []).map((idea: any) => ({
      ...idea,
      createdAt: new Date(idea.createdAt || Date.now())
    }));

    await aiCache.set(cacheKey, ideas);
    return ideas;
  } catch (error) {
    console.error('Six Hats generation error:', error);
    return [];
  }
}

// ============================================
// Export Features
// ============================================

/**
 * Export brainstorm session to various formats
 */
export interface ExportOptions {
  format: 'markdown' | 'json' | 'mindmap' | 'presentation';
  includeVotes?: boolean;
  includeClusters?: boolean;
  includeTimestamps?: boolean;
}

export function exportBrainstorm(
  session: BrainstormSession,
  options: ExportOptions
): string {
  switch (options.format) {
    case 'markdown':
      return exportToMarkdown(session, options);
    case 'json':
      return JSON.stringify(session, null, 2);
    case 'mindmap':
      return exportToMindmap(session);
    case 'presentation':
      return exportToPresentation(session);
    default:
      return '';
  }
}

function exportToMarkdown(session: BrainstormSession, options: ExportOptions): string {
  let md = `# Brainstorm: ${session.topic}\n\n`;
  md += `*Created: ${session.createdAt.toLocaleDateString()}*\n\n`;

  if (session.framework) {
    md += `**Framework:** ${session.framework}\n\n`;
  }

  md += `## Ideas (${session.ideas.length})\n\n`;

  // Group by clusters if enabled
  if (options.includeClusters && session.clusters.length > 0) {
    session.clusters.forEach(cluster => {
      md += `### ${cluster.name}\n\n`;
      const clusterIdeas = session.ideas.filter(i => i.clusterId === cluster.id);
      clusterIdeas.forEach(idea => {
        const votes = options.includeVotes ? ` [${idea.votes} votes]` : '';
        md += `- ${idea.text}${votes}\n`;
      });
      md += '\n';
    });

    // Unclustered
    const unclustered = session.ideas.filter(i => !i.clusterId);
    if (unclustered.length > 0) {
      md += `### Unclustered\n\n`;
      unclustered.forEach(idea => {
        const votes = options.includeVotes ? ` [${idea.votes} votes]` : '';
        md += `- ${idea.text}${votes}\n`;
      });
    }
  } else {
    // Sort by votes if enabled
    const sortedIdeas = options.includeVotes
      ? [...session.ideas].sort((a, b) => b.votes - a.votes)
      : session.ideas;

    sortedIdeas.forEach(idea => {
      const votes = options.includeVotes ? ` [${idea.votes} votes]` : '';
      md += `- ${idea.text}${votes}\n`;
    });
  }

  return md;
}

/**
 * Export to Mermaid.js mindmap format
 * Can be rendered in Markdown, GitHub, or Mermaid Live Editor
 */
function exportToMindmap(session: BrainstormSession): string {
  let mindmap = `# ${session.topic}\n\n`;
  mindmap += `\`\`\`mermaid\nmindmap\n`;
  mindmap += `  root((${session.topic}))\n`;

  if (session.clusters.length > 0) {
    // Organize by clusters
    session.clusters.forEach(cluster => {
      mindmap += `    ${cluster.name}\n`;

      const clusterIdeas = session.ideas.filter(i => i.clusterId === cluster.id);
      clusterIdeas.forEach(idea => {
        const ideaText = idea.text.replace(/\n/g, ' ').substring(0, 60);
        mindmap += `      ${ideaText}\n`;
      });
    });

    // Unclustered ideas
    const unclustered = session.ideas.filter(i => !i.clusterId);
    if (unclustered.length > 0) {
      mindmap += `    Other Ideas\n`;
      unclustered.forEach(idea => {
        const ideaText = idea.text.replace(/\n/g, ' ').substring(0, 60);
        mindmap += `      ${ideaText}\n`;
      });
    }
  } else {
    // No clusters, list all ideas
    session.ideas.forEach(idea => {
      const ideaText = idea.text.replace(/\n/g, ' ').substring(0, 60);
      mindmap += `    ${ideaText}\n`;
    });
  }

  mindmap += `\`\`\`\n\n`;
  mindmap += `*Generated on ${new Date().toLocaleDateString()}*\n`;
  mindmap += `*Total Ideas: ${session.ideas.length}*\n`;

  return mindmap;
}

/**
 * Export to HTML presentation format
 * Can be viewed in browser or converted to PDF
 */
function exportToPresentation(session: BrainstormSession): string {
  const styles = `
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        line-height: 1.6;
        max-width: 900px;
        margin: 0 auto;
        padding: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #333;
      }
      .slide {
        background: white;
        border-radius: 12px;
        padding: 40px;
        margin: 20px 0;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        page-break-after: always;
      }
      h1 {
        color: #667eea;
        font-size: 2.5em;
        margin-bottom: 10px;
      }
      h2 {
        color: #764ba2;
        font-size: 1.8em;
        border-bottom: 3px solid #667eea;
        padding-bottom: 10px;
        margin-top: 30px;
      }
      .meta {
        color: #666;
        font-size: 0.9em;
        margin-bottom: 20px;
      }
      .idea {
        background: #f8f9fa;
        border-left: 4px solid #667eea;
        padding: 15px;
        margin: 15px 0;
        border-radius: 4px;
      }
      .cluster {
        background: linear-gradient(135deg, #667eea20, #764ba220);
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
      }
      .votes {
        display: inline-block;
        background: #667eea;
        color: white;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 0.85em;
        margin-left: 10px;
      }
      .tag {
        display: inline-block;
        background: #f0f0f0;
        padding: 3px 10px;
        border-radius: 12px;
        font-size: 0.8em;
        margin: 2px;
      }
      .ai-badge {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        padding: 2px 8px;
        border-radius: 8px;
        font-size: 0.75em;
        margin-left: 8px;
      }
      @media print {
        body { background: white; }
        .slide { box-shadow: none; page-break-after: always; }
      }
    </style>
  `;

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${session.topic} - Brainstorm Presentation</title>
  ${styles}
</head>
<body>`;

  // Title Slide
  html += `
  <div class="slide">
    <h1>${session.topic}</h1>
    <div class="meta">
      <p><strong>Date:</strong> ${session.createdAt.toLocaleDateString()}</p>
      ${session.framework ? `<p><strong>Framework:</strong> ${session.framework}</p>` : ''}
      <p><strong>Total Ideas:</strong> ${session.ideas.length}</p>
      <p><strong>Clusters:</strong> ${session.clusters.length}</p>
    </div>
  </div>`;

  // Top Ideas Slide
  const topIdeas = [...session.ideas]
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 5);

  if (topIdeas.length > 0) {
    html += `
  <div class="slide">
    <h2>🌟 Top Ideas</h2>`;

    topIdeas.forEach((idea, index) => {
      html += `
    <div class="idea">
      <strong>${index + 1}. ${idea.text}</strong>
      <span class="votes">${idea.votes} votes</span>
      ${idea.aiGenerated ? '<span class="ai-badge">AI Generated</span>' : ''}
      ${idea.tags.length > 0 ? `<div style="margin-top:8px;">${idea.tags.map(t => `<span class="tag">${t}</span>`).join(' ')}</div>` : ''}
    </div>`;
    });

    html += `
  </div>`;
  }

  // Clusters Slides
  if (session.clusters.length > 0) {
    session.clusters.forEach(cluster => {
      const clusterIdeas = session.ideas.filter(i => i.clusterId === cluster.id);

      html += `
  <div class="slide">
    <h2>${cluster.icon || '📁'} ${cluster.name}</h2>
    ${cluster.theme ? `<p><em>${cluster.theme}</em></p>` : ''}`;

      clusterIdeas.forEach(idea => {
        html += `
    <div class="idea">
      ${idea.text}
      <span class="votes">${idea.votes} votes</span>
      ${idea.aiGenerated ? '<span class="ai-badge">AI</span>' : ''}
    </div>`;
      });

      html += `
  </div>`;
    });
  }

  // Summary Slide
  const analytics = analyzeBrainstorm(session);
  html += `
  <div class="slide">
    <h2>📊 Session Summary</h2>
    <div class="idea">
      <p><strong>Total Ideas:</strong> ${analytics.totalIdeas}</p>
      <p><strong>Clustered Ideas:</strong> ${analytics.clusteredIdeas} (${Math.round((analytics.clusteredIdeas / analytics.totalIdeas) * 100)}%)</p>
      <p><strong>Average Votes:</strong> ${analytics.averageVotes.toFixed(1)}</p>
    </div>
    <h3>Idea Distribution</h3>`;

  Object.entries(analytics.ideaDistribution).forEach(([name, count]) => {
    html += `<p><strong>${name}:</strong> ${count} ideas</p>`;
  });

  html += `
  </div>`;

  html += `
</body>
</html>`;

  return html;
}

// ============================================
// Analytics
// ============================================

export interface BrainstormAnalytics {
  totalIdeas: number;
  clusteredIdeas: number;
  averageVotes: number;
  topIdeas: BrainstormIdea[];
  ideaDistribution: Record<string, number>;
  participationRate?: number;
}

export function analyzeBrainstorm(session: BrainstormSession): BrainstormAnalytics {
  const totalIdeas = session.ideas.length;
  const clusteredIdeas = session.ideas.filter(i => i.clusterId).length;
  const totalVotes = session.ideas.reduce((sum, i) => sum + i.votes, 0);
  const averageVotes = totalIdeas > 0 ? totalVotes / totalIdeas : 0;

  const topIdeas = [...session.ideas]
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 5);

  const ideaDistribution: Record<string, number> = {};
  session.clusters.forEach(cluster => {
    ideaDistribution[cluster.name] = session.ideas.filter(i => i.clusterId === cluster.id).length;
  });
  ideaDistribution['Unclustered'] = session.ideas.filter(i => !i.clusterId).length;

  return {
    totalIdeas,
    clusteredIdeas,
    averageVotes,
    topIdeas,
    ideaDistribution
  };
}
