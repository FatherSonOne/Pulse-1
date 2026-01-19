/**
 * Search Operator Parser
 * Parses search queries with operators like from:email, type:email, date:2024-01
 */

export interface ParsedSearchQuery {
  rawQuery: string;
  baseQuery: string;
  operators: {
    from?: string;
    type?: string;
    date?: string;
    tag?: string;
    has?: string;
    priority?: string;
  };
}

export function parseSearchQuery(query: string): ParsedSearchQuery {
  const operators: ParsedSearchQuery['operators'] = {};
  let baseQuery = query;

  // Pattern: operator:value (can have spaces in value if quoted)
  const operatorPatterns = [
    { name: 'from', pattern: /from:("([^"]+)"|(\S+))/gi },
    { name: 'type', pattern: /type:("([^"]+)"|(\S+))/gi },
    { name: 'date', pattern: /date:("([^"]+)"|(\S+))/gi },
    { name: 'tag', pattern: /tag:("([^"]+)"|(\S+))/gi },
    { name: 'has', pattern: /has:("([^"]+)"|(\S+))/gi },
    { name: 'priority', pattern: /priority:("([^"]+)"|(\S+))/gi },
  ];

  operatorPatterns.forEach(({ name, pattern }) => {
    const matches = Array.from(query.matchAll(pattern));
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const value = lastMatch[2] || lastMatch[3] || '';
      operators[name as keyof typeof operators] = value;
      
      // Remove operator from base query
      baseQuery = baseQuery.replace(pattern, '').trim();
    }
  });

  // Clean up extra spaces
  baseQuery = baseQuery.replace(/\s+/g, ' ').trim();

  return {
    rawQuery: query,
    baseQuery,
    operators,
  };
}

export function buildSearchQuery(operators: ParsedSearchQuery['operators'], baseQuery: string): string {
  const parts: string[] = [];

  if (operators.from) parts.push(`from:${operators.from}`);
  if (operators.type) parts.push(`type:${operators.type}`);
  if (operators.date) parts.push(`date:${operators.date}`);
  if (operators.tag) parts.push(`tag:${operators.tag}`);
  if (operators.has) parts.push(`has:${operators.has}`);
  if (operators.priority) parts.push(`priority:${operators.priority}`);
  
  if (baseQuery) parts.push(baseQuery);

  return parts.join(' ');
}