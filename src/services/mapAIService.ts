// ─────────────────────────────────────────────────────────────────────────────
// Map AI service — fuels the PULSE AI · ROUTE / · PLAN / · INSIGHT strip.
//
// All calls route server-side through `ai-router`. No client API key is
// reintroduced. Each proposal function returns a typed shape or `null` on any
// failure (auth, rate cap, parse, timeout) so the AI strip can collapse
// silently without theatrical loading states. Speed is craft — fail quiet.
// ─────────────────────────────────────────────────────────────────────────────

import { invokeAIJson } from './ai/aiService';
import { getCurrentWorkspaceId } from './ai/getWorkspaceId';
import {
  AICapExceededError,
  AITrialExpiredError,
  AIProviderUnavailableError,
  AIJsonParseError,
} from './ai/errors';

// ─── Shared types ────────────────────────────────────────────────────────────

export interface RouteStopInput {
  /** Stable id (contact id + loc type, e.g. "abc-home") used to map the AI's
   *  proposed order back to the markers it referenced. */
  id: string;
  /** Display name the model can read ("Lucca Messana — Home"). */
  label: string;
  lat: number;
  lng: number;
}

export interface RouteProposal {
  /** Reordered ids forming the proposed visit sequence. May be a subset of
   *  the input when the model decides a stop isn't worth the detour. */
  orderedIds: string[];
  /** One-line description shown in the strip. */
  summary: string;
  /** Optional rationale shown in a "Why this order?" expansion. */
  rationale?: string;
}

export interface WeekProposal {
  /** Single-line headline ("Wednesday has 3 in Berkeley — batch them?"). */
  summary: string;
  /** Date in YYYY-MM-DD form that the suggestion centres on. */
  focusDate?: string;
}

export interface AtlasProposal {
  /** Single-line insight ("3 contacts in Oakland you haven't talked to in 30+ days."). */
  summary: string;
  /** Optional circle id or contact id the user should click into next. */
  focusId?: string;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

// Session-scoped circuit breaker. When the workspace hits its AI cap or its
// trial expires, we stop calling ai-router for a while so every lens switch
// doesn't generate a fresh 402. Resets after CIRCUIT_PAUSE_MS or on reload.
const CIRCUIT_PAUSE_MS = 30 * 60 * 1000; // 30 minutes
let circuitPausedUntil = 0;

function isCircuitOpen(): boolean {
  return Date.now() < circuitPausedUntil;
}

/** Public read of the circuit state for UI surfacing. Returns the timestamp
 *  the pause clears at (ms epoch), or null when the circuit is closed.
 *  Components shouldn't poll this in a tight loop — call it on mount and on
 *  every proposal attempt is plenty. */
export function getAiPausedUntil(): number | null {
  return isCircuitOpen() ? circuitPausedUntil : null;
}

function silentFailureCatch(err: unknown): null {
  // Errors we surface in dev logs but never crash the UI for. Strip collapses.
  if (err instanceof AICapExceededError || err instanceof AITrialExpiredError) {
    // Workspace-level capacity issue — stop calling ai-router for a while.
    circuitPausedUntil = Date.now() + CIRCUIT_PAUSE_MS;
    if (typeof console !== 'undefined') {
      console.debug('[mapAI] proposals paused for 30m:', err.message);
    }
    return null;
  }
  if (
    err instanceof AIProviderUnavailableError ||
    err instanceof AIJsonParseError
  ) {
    if (typeof console !== 'undefined') console.debug('[mapAI] proposal skipped:', err.message);
    return null;
  }
  if (typeof console !== 'undefined') console.debug('[mapAI] proposal failed:', err);
  return null;
}

/** Wrap an in-flight invocation with a hard timeout. The router's own latency
 *  budget plus a 1500ms client cap matches the brief's "paint first, AI
 *  overlays when ready, no spinner ever" UX. */
async function withTimeout<T>(p: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('mapAI:timeout')), ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('mapAI:aborted'));
    };
    if (signal) {
      if (signal.aborted) { onAbort(); return; }
      signal.addEventListener('abort', onAbort, { once: true });
    }
    p.then(
      v => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); resolve(v); },
      e => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); reject(e); },
    );
  });
}

// ─── Today: route proposal ───────────────────────────────────────────────────

interface ProposeRouteOpts {
  stops: RouteStopInput[];
  origin?: { lat: number; lng: number } | null;
  signal?: AbortSignal;
  /** Override the default 1500ms client timeout (caller controls UX cadence). */
  timeoutMs?: number;
  /** Stop ids the operator has already arrived at today (sourced from
   *  geofence_events). The model sees them as "already done" — won't
   *  reorder them back into the route, and uses them as anchors when
   *  reasoning about what's near. */
  visitedIds?: string[];
}

export async function proposeRoute(opts: ProposeRouteOpts): Promise<RouteProposal | null> {
  const { stops, origin, signal, timeoutMs = 1500, visitedIds = [] } = opts;
  // Remove already-visited stops up front — fewer tokens, no chance of the
  // model re-proposing them. Visited ids that aren't in stops are ignored.
  const visitedSet = new Set(visitedIds);
  const liveStops = stops.filter(s => !visitedSet.has(s.id));
  if (liveStops.length < 2) return null;
  if (isCircuitOpen()) return null;

  const workspaceId = getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const originLine = origin
    ? `You start at (${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}).`
    : 'Starting point is unknown — order the stops as if starting from the first one.';

  const visitedLabels = stops
    .filter(s => visitedSet.has(s.id))
    .map(s => s.label);
  const visitedLine = visitedLabels.length > 0
    ? `\nAlready visited today (do not re-route to these): ${visitedLabels.join('; ')}.`
    : '';

  const stopLines = liveStops.map((s, i) =>
    `${i + 1}. id="${s.id}"  ${s.label}  (${s.lat.toFixed(4)}, ${s.lng.toFixed(4)})`,
  ).join('\n');

  const prompt = `${originLine}${visitedLine}

You're proposing a same-day visit order for a solo operator. Output strict JSON.

Remaining stops:
${stopLines}

Return JSON shaped exactly like:
{"orderedIds": ["id1", "id2", ...], "summary": "<one sentence, no em dashes>", "rationale": "<optional>"}

Rules:
- orderedIds is a permutation (or subset) of the remaining-stop ids above. Use the exact id strings. Do NOT include already-visited ids.
- summary is one sentence, no em dashes (use commas, colons, or periods).
- Optimise for total drive time. If two stops are equidistant, prefer the one that keeps the operator near later commitments.
- If a stop is wildly out of the way, drop it from orderedIds and mention that in summary.`;

  try {
    const result = await withTimeout(
      invokeAIJson<RouteProposal>('calendar_prep', prompt, {
        workspaceId,
        signal,
        systemPrompt: 'You return strict JSON. No prose around it. No em dashes anywhere in user-visible text.',
        temperature: 0.2,
      }),
      timeoutMs,
      signal,
    );
    if (!result || !Array.isArray(result.orderedIds) || result.orderedIds.length === 0) return null;
    // Defence against models inventing ids or re-introducing visited ones
    // despite the prompt rule. Only liveStops are valid in the output.
    const validIds = new Set(liveStops.map(s => s.id));
    const filtered = result.orderedIds.filter(id => validIds.has(id));
    if (filtered.length < 2) return null;
    return { orderedIds: filtered, summary: result.summary || `${filtered.length} stops in order.`, rationale: result.rationale };
  } catch (err) {
    return silentFailureCatch(err);
  }
}

// ─── Week: planning suggestion ───────────────────────────────────────────────

interface WeekStopInput extends RouteStopInput {
  /** ISO date string the stop is associated with (meeting date, task due, etc). */
  date?: string;
}

interface ProposeWeekPlanOpts {
  stops: WeekStopInput[];
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function proposeWeekPlan(opts: ProposeWeekPlanOpts): Promise<WeekProposal | null> {
  const { stops, signal, timeoutMs = 1500 } = opts;
  if (stops.length < 2) return null;
  if (isCircuitOpen()) return null;

  const workspaceId = getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const lines = stops.map(s =>
    `- ${s.date ?? '----'}  ${s.label}  (${s.lat.toFixed(4)}, ${s.lng.toFixed(4)})`,
  ).join('\n');

  const prompt = `You're a chief of staff scanning a solo operator's week of geographically-anchored items. Output strict JSON.

Items:
${lines}

Return JSON shaped exactly like:
{"summary": "<one sentence pointing to a single batching or routing opportunity, no em dashes>", "focusDate": "<YYYY-MM-DD or omit>"}

Rules:
- summary is one sentence, no em dashes.
- Surface the highest-leverage suggestion only (batching co-located items, flagging a back-to-back conflict, etc.).
- If nothing notable, summary should state that plainly.`;

  try {
    const result = await withTimeout(
      invokeAIJson<WeekProposal>('task_prioritization', prompt, {
        workspaceId,
        signal,
        systemPrompt: 'You return strict JSON. One sentence. No em dashes.',
        temperature: 0.3,
      }),
      timeoutMs,
      signal,
    );
    if (!result?.summary) return null;
    return { summary: result.summary.trim(), focusDate: result.focusDate };
  } catch (err) {
    return silentFailureCatch(err);
  }
}

// ─── Atlas: network insight ──────────────────────────────────────────────────

interface AtlasContactSnapshot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Days since last interaction; null when unknown. */
  staleDays: number | null;
  circles: string[];
}

interface ProposeAtlasInsightOpts {
  contacts: AtlasContactSnapshot[];
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function proposeAtlasInsight(opts: ProposeAtlasInsightOpts): Promise<AtlasProposal | null> {
  const { contacts, signal, timeoutMs = 1500 } = opts;
  if (contacts.length < 3) return null;
  if (isCircuitOpen()) return null;

  const workspaceId = getCurrentWorkspaceId();
  if (!workspaceId) return null;

  // Trim the prompt; the model doesn't need every contact for a single
  // insight. Stalest first, capped at 30.
  const ranked = contacts
    .slice()
    .sort((a, b) => (b.staleDays ?? -1) - (a.staleDays ?? -1))
    .slice(0, 30);

  const lines = ranked.map(c =>
    `- id=${c.id}  ${c.name}  (${c.lat.toFixed(3)}, ${c.lng.toFixed(3)})  stale=${c.staleDays ?? '?'}d  circles=${c.circles.join('|') || '-'}`,
  ).join('\n');

  const prompt = `Solo operator's network atlas. Find one geographically-grounded relationship insight worth a single sentence.

Contacts:
${lines}

Return JSON shaped exactly like:
{"summary": "<one sentence, no em dashes>", "focusId": "<id worth opening next, or omit>"}

Rules:
- Lead with concrete numbers and place names when possible.
- One sentence. No em dashes.
- If nothing notable surfaces, return a plain summary saying the network looks active.`;

  try {
    const result = await withTimeout(
      invokeAIJson<AtlasProposal>('proactive_nudge', prompt, {
        workspaceId,
        signal,
        systemPrompt: 'You return strict JSON. One sentence. No em dashes.',
        temperature: 0.35,
      }),
      timeoutMs,
      signal,
    );
    if (!result?.summary) return null;
    return { summary: result.summary.trim(), focusId: result.focusId };
  } catch (err) {
    return silentFailureCatch(err);
  }
}
