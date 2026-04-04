/**
 * artifactParser.ts — Detects structured content in AI responses and extracts
 * typed artifacts for rich inline rendering.
 *
 * Artifacts are detected from markdown patterns:
 *  - Tables → decision-matrix or comparison
 *  - "Pros" / "Cons" headers → pros-cons
 *  - "Action Items" / numbered tasks → action-items
 *  - "Key Points" / "Summary" → summary
 *  - "Timeline" / dated items → timeline
 *  - "Ideas" / bullet brainstorms → ideas
 *  - "Risks" header + list → risk-assessment
 *
 * Content that doesn't match any pattern stays as plain text segments.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type ArtifactType =
  | 'summary'
  | 'pros-cons'
  | 'action-items'
  | 'decision-matrix'
  | 'ideas'
  | 'timeline'
  | 'risk-assessment';

export interface ArtifactSummary {
  type: 'summary';
  title: string;
  points: string[];
}

export interface ArtifactProsCons {
  type: 'pros-cons';
  title: string;
  pros: string[];
  cons: string[];
}

export interface ArtifactActionItems {
  type: 'action-items';
  title: string;
  items: { text: string; done: boolean }[];
}

export interface ArtifactDecisionMatrix {
  type: 'decision-matrix';
  title: string;
  headers: string[];
  rows: string[][];
}

export interface ArtifactIdeas {
  type: 'ideas';
  title: string;
  ideas: { text: string; votes: number }[];
}

export interface ArtifactTimeline {
  type: 'timeline';
  title: string;
  events: { label: string; description: string }[];
}

export interface ArtifactRiskAssessment {
  type: 'risk-assessment';
  title: string;
  risks: { risk: string; likelihood: string; impact: string; mitigation: string }[];
}

export type Artifact =
  | ArtifactSummary
  | ArtifactProsCons
  | ArtifactActionItems
  | ArtifactDecisionMatrix
  | ArtifactIdeas
  | ArtifactTimeline
  | ArtifactRiskAssessment;

/** A segment of a message — either plain text or a rich artifact */
export type MessageSegment =
  | { kind: 'text'; content: string }
  | { kind: 'artifact'; artifact: Artifact };

// ── Helpers ────────────────────────────────────────────────────────────────────

function trimBullet(line: string): string {
  return line.replace(/^[\s]*[-*•]\s*/, '').replace(/^\d+[.)]\s*/, '').trim();
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
}

// ── Section splitter ───────────────────────────────────────────────────────────

interface RawSection {
  heading: string;
  body: string[];
}

/**
 * Split text into sections by markdown headings (##, ###, **Bold:**).
 * Lines before any heading go into a section with heading = ''.
 */
function splitSections(text: string): RawSection[] {
  const lines = text.split('\n');
  const sections: RawSection[] = [];
  let current: RawSection = { heading: '', body: [] };

  for (const line of lines) {
    // Match ## Heading or ### Heading
    const headingMatch = line.match(/^#{2,4}\s+(.+)$/);
    // Match **Bold Header:** or **Bold Header**
    const boldMatch = !headingMatch ? line.match(/^\*\*([^*]+?)(?::)?\*\*\s*$/) : null;

    if (headingMatch || boldMatch) {
      if (current.heading || current.body.length > 0) {
        sections.push(current);
      }
      current = { heading: (headingMatch?.[1] || boldMatch?.[1] || '').trim(), body: [] };
    } else {
      current.body.push(line);
    }
  }
  if (current.heading || current.body.length > 0) {
    sections.push(current);
  }

  return sections;
}

// ── Pattern matchers ───────────────────────────────────────────────────────────

function tryParseSummary(section: RawSection): ArtifactSummary | null {
  const h = section.heading.toLowerCase();
  if (!/(summary|key\s*points|overview|highlights|takeaways|tldr|tl;dr)/.test(h)) return null;

  const points = section.body
    .filter(l => /^\s*[-*•]\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l))
    .map(trimBullet)
    .filter(Boolean);

  if (points.length < 2) return null;

  return { type: 'summary', title: section.heading, points };
}

function tryParseProsCons(sections: RawSection[], startIdx: number): { artifact: ArtifactProsCons; consumed: number } | null {
  const h = sections[startIdx].heading.toLowerCase();
  if (!/\bpros?\b/.test(h) && !/\badvantage/.test(h) && !/\bstrength/.test(h)) return null;

  const pros = sections[startIdx].body
    .filter(l => /^\s*[-*•]\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l))
    .map(trimBullet)
    .filter(Boolean);

  if (pros.length === 0) return null;

  // Look for a following Cons section
  let cons: string[] = [];
  let consumed = 1;

  if (startIdx + 1 < sections.length) {
    const nextH = sections[startIdx + 1].heading.toLowerCase();
    if (/\bcons?\b/.test(nextH) || /\bdisadvantage/.test(nextH) || /\bweakness/.test(nextH)) {
      cons = sections[startIdx + 1].body
        .filter(l => /^\s*[-*•]\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l))
        .map(trimBullet)
        .filter(Boolean);
      consumed = 2;
    }
  }

  if (cons.length === 0 && pros.length < 2) return null;

  return {
    artifact: { type: 'pros-cons', title: 'Pros & Cons', pros, cons },
    consumed,
  };
}

function tryParseActionItems(section: RawSection): ArtifactActionItems | null {
  const h = section.heading.toLowerCase();
  if (!/(action\s*items?|next\s*steps?|tasks?|to[- ]?do|recommendations?)/.test(h)) return null;

  const items = section.body
    .filter(l => /^\s*[-*•]\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l) || /^\s*\[[ x]\]\s+/i.test(l))
    .map(l => {
      const done = /^\s*\[x\]/i.test(l);
      const text = trimBullet(l.replace(/^\s*\[[ x]\]\s*/i, ''));
      return { text, done };
    })
    .filter(item => item.text.length > 0);

  if (items.length < 2) return null;

  return { type: 'action-items', title: section.heading, items };
}

function tryParseTable(section: RawSection): ArtifactDecisionMatrix | null {
  // Find table rows (lines starting and ending with |)
  const tableLines = section.body.filter(l => l.trim().startsWith('|') && l.trim().endsWith('|'));

  if (tableLines.length < 3) return null; // header + separator + at least one row

  // Check for separator
  const sepIdx = tableLines.findIndex(l => isTableSeparator(l));
  if (sepIdx < 1) return null;

  const headers = splitTableRow(tableLines[sepIdx - 1]);
  const rows = tableLines
    .slice(sepIdx + 1)
    .filter(l => !isTableSeparator(l))
    .map(splitTableRow);

  if (headers.length < 2 || rows.length < 1) return null;

  const title = section.heading || 'Comparison';
  return { type: 'decision-matrix', title, headers, rows };
}

function tryParseIdeas(section: RawSection): ArtifactIdeas | null {
  const h = section.heading.toLowerCase();
  if (!/(ideas?|brainstorm|suggestions?|options?|possibilities|concepts?)/.test(h)) return null;

  const ideas = section.body
    .filter(l => /^\s*[-*•]\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l))
    .map(l => ({ text: trimBullet(l), votes: 0 }))
    .filter(i => i.text.length > 0);

  if (ideas.length < 2) return null;

  return { type: 'ideas', title: section.heading, ideas };
}

function tryParseTimeline(section: RawSection): ArtifactTimeline | null {
  const h = section.heading.toLowerCase();
  if (!/(timeline|milestones?|phases?|roadmap|schedule|steps?)/.test(h)) return null;

  const events: { label: string; description: string }[] = [];

  for (const line of section.body) {
    if (!/^\s*[-*•]\s+/.test(line) && !/^\s*\d+[.)]\s+/.test(line)) continue;

    const text = trimBullet(line);
    // Try to split on : or — or -
    const sepMatch = text.match(/^(.+?)(?:\s*[:\u2014\u2013–]\s*)(.+)$/);
    if (sepMatch) {
      events.push({ label: sepMatch[1].trim(), description: sepMatch[2].trim() });
    } else {
      events.push({ label: `Step ${events.length + 1}`, description: text });
    }
  }

  if (events.length < 2) return null;

  return { type: 'timeline', title: section.heading, events };
}

function tryParseRisks(section: RawSection): ArtifactRiskAssessment | null {
  const h = section.heading.toLowerCase();
  if (!/(risks?|threats?|concerns?|challenges?)/.test(h)) return null;

  // Check if there's a table inside
  const table = tryParseTable(section);
  if (table && table.headers.some(h => /risk|likelihood|impact|mitigation/i.test(h))) {
    const riskIdx = table.headers.findIndex(h => /risk|name|description/i.test(h));
    const likIdx = table.headers.findIndex(h => /likelihood|probability/i.test(h));
    const impIdx = table.headers.findIndex(h => /impact|severity/i.test(h));
    const mitIdx = table.headers.findIndex(h => /mitigation|action|response/i.test(h));

    const risks = table.rows.map(r => ({
      risk: r[riskIdx >= 0 ? riskIdx : 0] || '',
      likelihood: likIdx >= 0 ? r[likIdx] || '' : '',
      impact: impIdx >= 0 ? r[impIdx] || '' : '',
      mitigation: mitIdx >= 0 ? r[mitIdx] || '' : '',
    })).filter(r => r.risk);

    if (risks.length >= 1) {
      return { type: 'risk-assessment', title: section.heading, risks };
    }
  }

  // Fallback: bullet list of risks
  const risks = section.body
    .filter(l => /^\s*[-*•]\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l))
    .map(l => ({
      risk: trimBullet(l),
      likelihood: '',
      impact: '',
      mitigation: '',
    }))
    .filter(r => r.risk.length > 0);

  if (risks.length < 2) return null;

  return { type: 'risk-assessment', title: section.heading, risks };
}

// ── Main parser ────────────────────────────────────────────────────────────────

/**
 * Parse an AI response into a sequence of text segments and rich artifacts.
 * Plain text passes through unchanged; structured sections become artifacts.
 */
export function parseMessageContent(content: string): MessageSegment[] {
  if (!content || content.length < 30) {
    return [{ kind: 'text', content }];
  }

  const sections = splitSections(content);
  const segments: MessageSegment[] = [];
  let i = 0;

  while (i < sections.length) {
    const section = sections[i];
    let matched = false;

    // Try each pattern (order matters: more specific first)

    // 1. Pros/Cons (consumes 1-2 sections)
    const prosCons = tryParseProsCons(sections, i);
    if (prosCons) {
      segments.push({ kind: 'artifact', artifact: prosCons.artifact });
      i += prosCons.consumed;
      matched = true;
    }

    if (!matched) {
      // 2. Table / Decision Matrix
      const table = tryParseTable(section);
      if (table) {
        segments.push({ kind: 'artifact', artifact: table });
        i++;
        matched = true;
      }
    }

    if (!matched) {
      // 3. Risk Assessment (must come before generic table since it may have tables)
      const risks = tryParseRisks(section);
      if (risks) {
        segments.push({ kind: 'artifact', artifact: risks });
        i++;
        matched = true;
      }
    }

    if (!matched) {
      // 4. Action Items
      const actions = tryParseActionItems(section);
      if (actions) {
        segments.push({ kind: 'artifact', artifact: actions });
        i++;
        matched = true;
      }
    }

    if (!matched) {
      // 5. Timeline
      const timeline = tryParseTimeline(section);
      if (timeline) {
        segments.push({ kind: 'artifact', artifact: timeline });
        i++;
        matched = true;
      }
    }

    if (!matched) {
      // 6. Ideas / Brainstorm
      const ideas = tryParseIdeas(section);
      if (ideas) {
        segments.push({ kind: 'artifact', artifact: ideas });
        i++;
        matched = true;
      }
    }

    if (!matched) {
      // 7. Summary / Key Points
      const summary = tryParseSummary(section);
      if (summary) {
        segments.push({ kind: 'artifact', artifact: summary });
        i++;
        matched = true;
      }
    }

    if (!matched) {
      // No pattern matched — emit as plain text
      const text = [
        section.heading ? `## ${section.heading}` : '',
        ...section.body,
      ].filter(Boolean).join('\n');

      if (text.trim()) {
        // Merge with previous text segment if possible
        const last = segments[segments.length - 1];
        if (last && last.kind === 'text') {
          last.content += '\n\n' + text;
        } else {
          segments.push({ kind: 'text', content: text });
        }
      }
      i++;
    }
  }

  // If parser produced only one text segment with the full content, skip parsing overhead
  if (segments.length === 1 && segments[0].kind === 'text') {
    return [{ kind: 'text', content }];
  }

  return segments;
}

/**
 * Quick check: does this message content likely contain artifacts?
 * Used to skip parsing for short/simple messages.
 */
export function hasLikelyArtifacts(content: string): boolean {
  if (!content || content.length < 80) return false;
  // Check for markdown headings + bullet lists or tables
  return (
    (/^#{2,4}\s+/m.test(content) || /^\*\*[^*]+\*\*\s*$/m.test(content)) &&
    (/^\s*[-*•]\s+/m.test(content) || /^\|.+\|$/m.test(content))
  );
}
