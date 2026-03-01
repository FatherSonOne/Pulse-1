/**
 * Search Analytics Service
 *
 * Lightweight client-side search telemetry stored in localStorage.
 * Tracks: query frequency, zero-result queries, result click-through by type.
 * Data is scoped per user and expires after 30 days.
 */

const STORAGE_KEY_PREFIX = 'pulse:search:analytics:';
const EXPIRY_DAYS = 30;

export interface QueryRecord {
  query: string;
  count: number;
  lastUsed: number;   // unix ms
  resultCount: number;
  zeroResults: boolean;
}

export interface ClickRecord {
  query: string;
  resultType: string;
  count: number;
  lastClicked: number; // unix ms
}

export interface SearchAnalyticsSummary {
  topQueries: QueryRecord[];
  zeroResultQueries: QueryRecord[];
  clicksByType: Record<string, number>;
  totalSearches: number;
  totalClicks: number;
}

class SearchAnalyticsService {
  private getKey(userId: string, type: 'queries' | 'clicks'): string {
    return `${STORAGE_KEY_PREFIX}${userId}:${type}`;
  }

  private readQueries(userId: string): QueryRecord[] {
    try {
      const raw = localStorage.getItem(this.getKey(userId, 'queries'));
      if (!raw) return [];
      const items: QueryRecord[] = JSON.parse(raw);
      const cutoff = Date.now() - EXPIRY_DAYS * 86_400_000;
      return items.filter(r => r.lastUsed > cutoff);
    } catch {
      return [];
    }
  }

  private writeQueries(userId: string, records: QueryRecord[]): void {
    try {
      // Keep top 200 by count to cap storage usage
      const trimmed = records.sort((a, b) => b.count - a.count).slice(0, 200);
      localStorage.setItem(this.getKey(userId, 'queries'), JSON.stringify(trimmed));
    } catch {
      // Storage quota — silently ignore
    }
  }

  private readClicks(userId: string): ClickRecord[] {
    try {
      const raw = localStorage.getItem(this.getKey(userId, 'clicks'));
      if (!raw) return [];
      const items: ClickRecord[] = JSON.parse(raw);
      const cutoff = Date.now() - EXPIRY_DAYS * 86_400_000;
      return items.filter(r => r.lastClicked > cutoff);
    } catch {
      return [];
    }
  }

  private writeClicks(userId: string, records: ClickRecord[]): void {
    try {
      const trimmed = records.sort((a, b) => b.count - a.count).slice(0, 500);
      localStorage.setItem(this.getKey(userId, 'clicks'), JSON.stringify(trimmed));
    } catch {
      // Storage quota — silently ignore
    }
  }

  /** Called after each search completes */
  trackSearch(userId: string, query: string, resultCount: number): void {
    if (!query.trim()) return;
    const normalised = query.trim().toLowerCase();
    const records = this.readQueries(userId);
    const existing = records.find(r => r.query === normalised);
    if (existing) {
      existing.count++;
      existing.lastUsed = Date.now();
      existing.resultCount = resultCount;
      existing.zeroResults = resultCount === 0;
    } else {
      records.push({
        query: normalised,
        count: 1,
        lastUsed: Date.now(),
        resultCount,
        zeroResults: resultCount === 0,
      });
    }
    this.writeQueries(userId, records);
  }

  /** Called when user clicks / activates a result card */
  trackClick(userId: string, query: string, resultType: string): void {
    if (!query.trim()) return;
    const normalised = query.trim().toLowerCase();
    const records = this.readClicks(userId);
    const existing = records.find(r => r.query === normalised && r.resultType === resultType);
    if (existing) {
      existing.count++;
      existing.lastClicked = Date.now();
    } else {
      records.push({
        query: normalised,
        resultType,
        count: 1,
        lastClicked: Date.now(),
      });
    }
    this.writeClicks(userId, records);
  }

  /** Top N queries by frequency */
  getTopQueries(userId: string, limit = 10): QueryRecord[] {
    return this.readQueries(userId)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /** Queries that returned zero results */
  getZeroResultQueries(userId: string, limit = 10): QueryRecord[] {
    return this.readQueries(userId)
      .filter(r => r.zeroResults)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /** Click-through counts grouped by result type */
  getClicksByType(userId: string): Record<string, number> {
    const clicks = this.readClicks(userId);
    const byType: Record<string, number> = {};
    for (const c of clicks) {
      byType[c.resultType] = (byType[c.resultType] ?? 0) + c.count;
    }
    return byType;
  }

  /** Full analytics summary for display */
  getSummary(userId: string): SearchAnalyticsSummary {
    const queries = this.readQueries(userId);
    const clicks = this.readClicks(userId);
    return {
      topQueries: queries.sort((a, b) => b.count - a.count).slice(0, 10),
      zeroResultQueries: queries.filter(r => r.zeroResults).sort((a, b) => b.count - a.count).slice(0, 10),
      clicksByType: this.getClicksByType(userId),
      totalSearches: queries.reduce((s, r) => s + r.count, 0),
      totalClicks: clicks.reduce((s, r) => s + r.count, 0),
    };
  }

  /** Clear all analytics for a user */
  clearAll(userId: string): void {
    localStorage.removeItem(this.getKey(userId, 'queries'));
    localStorage.removeItem(this.getKey(userId, 'clicks'));
  }
}

export const searchAnalyticsService = new SearchAnalyticsService();
