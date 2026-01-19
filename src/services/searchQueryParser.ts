// Search Query Parser
// Parse Gmail-style search operators for advanced email search

import type { CachedEmail } from './emailSyncService';

export interface SearchQuery {
  operators: SearchOperator[];
  freeText: string;
}

export interface SearchOperator {
  field: string;
  operator: string;
  value: string | number | Date | boolean;
  negate?: boolean; // For - prefix
}

export interface SearchFilters {
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  hasAttachment?: boolean;
  filename?: string;
  minSize?: number;
  maxSize?: number;
  afterDate?: Date;
  beforeDate?: Date;
  isUnread?: boolean;
  isRead?: boolean;
  isStarred?: boolean;
  isImportant?: boolean;
  label?: string;
  category?: string;
  cc?: string;
  bcc?: string;
  folder?: string;
  hasLink?: boolean;
  negateFilters?: Partial<SearchFilters>; // For negated searches
}

class SearchQueryParser {
  // Supported operators with their field mappings
  private readonly operatorMap: Record<string, string> = {
    'from': 'from',
    'to': 'to',
    'subject': 'subject',
    'body': 'body',
    'has': 'has',
    'filename': 'filename',
    'larger': 'size',
    'smaller': 'size',
    'after': 'date',
    'before': 'date',
    'is': 'status',
    'label': 'label',
    'category': 'category',
    'cc': 'cc',
    'bcc': 'bcc',
    'in': 'folder',
    'deliveredto': 'to',
    'list': 'list',
  };

  /**
   * Parse a search query string
   */
  parse(query: string): SearchQuery {
    const tokens = this.tokenize(query);
    const operators: SearchOperator[] = [];
    const freeTextParts: string[] = [];

    for (const token of tokens) {
      const operator = this.parseOperator(token);
      if (operator) {
        operators.push(operator);
      } else {
        // Not an operator, treat as free text
        freeTextParts.push(token);
      }
    }

    return {
      operators,
      freeText: freeTextParts.join(' ').trim(),
    };
  }

  /**
   * Tokenize the query string, preserving quoted strings
   */
  private tokenize(query: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < query.length; i++) {
      const char = query[i];

      if ((char === '"' || char === "'") && !inQuotes) {
        // Start of quoted string
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (char === quoteChar && inQuotes) {
        // End of quoted string
        inQuotes = false;
        current += char;
        tokens.push(current.trim());
        current = '';
        quoteChar = '';
      } else if (char === ' ' && !inQuotes) {
        // Space outside quotes - token boundary
        if (current.trim()) {
          tokens.push(current.trim());
        }
        current = '';
      } else {
        current += char;
      }
    }

    // Add remaining token
    if (current.trim()) {
      tokens.push(current.trim());
    }

    return tokens;
  }

  /**
   * Parse a single token to see if it's an operator
   */
  private parseOperator(token: string): SearchOperator | null {
    // Check for negation
    const negate = token.startsWith('-');
    if (negate) {
      token = token.substring(1);
    }

    // Check if token contains colon (operator:value)
    const colonIndex = token.indexOf(':');
    if (colonIndex === -1) {
      return null; // Not an operator
    }

    const field = token.substring(0, colonIndex).toLowerCase();
    let value = token.substring(colonIndex + 1);

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.substring(1, value.length - 1);
    }

    // Map field to internal representation
    const mappedField = this.operatorMap[field];
    if (!mappedField) {
      return null; // Unknown operator
    }

    return {
      field: mappedField,
      operator: this.getOperatorType(field),
      value: this.parseValue(field, value),
      negate,
    };
  }

  /**
   * Determine the operator type based on field
   */
  private getOperatorType(field: string): string {
    switch (field) {
      case 'larger':
        return 'greater_than';
      case 'smaller':
        return 'less_than';
      case 'after':
        return 'after';
      case 'before':
        return 'before';
      default:
        return 'contains';
    }
  }

  /**
   * Parse value based on field type
   */
  private parseValue(field: string, value: string): string | number | Date | boolean {
    switch (field) {
      case 'larger':
      case 'smaller':
        // Size in MB
        const sizeMatch = value.match(/^(\d+)(mb|kb|b)?$/i);
        if (sizeMatch) {
          const num = parseInt(sizeMatch[1]);
          const unit = (sizeMatch[2] || 'b').toLowerCase();
          
          switch (unit) {
            case 'mb':
              return num * 1024 * 1024;
            case 'kb':
              return num * 1024;
            default:
              return num;
          }
        }
        return parseInt(value);

      case 'after':
      case 'before':
        return this.parseDate(value);

      case 'has':
        // Boolean checks
        return value.toLowerCase();

      default:
        return value;
    }
  }

  /**
   * Parse date string (supports various formats)
   */
  private parseDate(dateStr: string): Date {
    // Try common formats
    // YYYY-MM-DD
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return new Date(dateStr);
    }

    // MM/DD/YYYY
    const usMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (usMatch) {
      return new Date(dateStr);
    }

    // Relative dates
    const lowerDate = dateStr.toLowerCase();
    const now = new Date();

    if (lowerDate === 'today') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    if (lowerDate === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }

    // N days/weeks/months ago
    const relativeMatch = dateStr.match(/^(\d+)(d|w|m|y)$/i);
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1]);
      const unit = relativeMatch[2].toLowerCase();
      const date = new Date(now);

      switch (unit) {
        case 'd':
          date.setDate(date.getDate() - amount);
          break;
        case 'w':
          date.setDate(date.getDate() - amount * 7);
          break;
        case 'm':
          date.setMonth(date.getMonth() - amount);
          break;
        case 'y':
          date.setFullYear(date.getFullYear() - amount);
          break;
      }

      return date;
    }

    // Fallback to Date.parse
    return new Date(dateStr);
  }

  /**
   * Convert search query to filters
   */
  toFilters(query: SearchQuery): SearchFilters {
    const filters: SearchFilters = {};
    const negateFilters: Partial<SearchFilters> = {};

    for (const op of query.operators) {
      const targetFilters = op.negate ? negateFilters : filters;

      switch (op.field) {
        case 'from':
          targetFilters.from = String(op.value);
          break;
        case 'to':
          targetFilters.to = String(op.value);
          break;
        case 'subject':
          targetFilters.subject = String(op.value);
          break;
        case 'body':
          targetFilters.body = String(op.value);
          break;
        case 'has':
          const hasValue = String(op.value).toLowerCase();
          if (hasValue === 'attachment') {
            targetFilters.hasAttachment = true;
          } else if (hasValue === 'link' || hasValue === 'url') {
            targetFilters.hasLink = true;
          }
          break;
        case 'filename':
          targetFilters.filename = String(op.value);
          break;
        case 'size':
          if (op.operator === 'greater_than') {
            filters.minSize = Number(op.value);
          } else if (op.operator === 'less_than') {
            filters.maxSize = Number(op.value);
          }
          break;
        case 'date':
          if (op.operator === 'after') {
            filters.afterDate = op.value as Date;
          } else if (op.operator === 'before') {
            filters.beforeDate = op.value as Date;
          }
          break;
        case 'status':
          const statusValue = String(op.value).toLowerCase();
          if (statusValue === 'unread') {
            targetFilters.isUnread = true;
          } else if (statusValue === 'read') {
            targetFilters.isRead = true;
          } else if (statusValue === 'starred') {
            targetFilters.isStarred = true;
          } else if (statusValue === 'important') {
            targetFilters.isImportant = true;
          }
          break;
        case 'label':
          targetFilters.label = String(op.value);
          break;
        case 'category':
          targetFilters.category = String(op.value);
          break;
        case 'cc':
          targetFilters.cc = String(op.value);
          break;
        case 'bcc':
          targetFilters.bcc = String(op.value);
          break;
        case 'folder':
          targetFilters.folder = String(op.value);
          break;
      }
    }

    if (Object.keys(negateFilters).length > 0) {
      filters.negateFilters = negateFilters;
    }

    return filters;
  }

  /**
   * Check if an email matches the search filters
   */
  matchesFilters(email: CachedEmail, filters: SearchFilters): boolean {
    // Check positive filters
    if (filters.from && !email.from_email.toLowerCase().includes(filters.from.toLowerCase())) {
      return false;
    }

    if (filters.to) {
      const toEmails = email.to_emails.map(t => 
        (typeof t === 'string' ? t : t.email).toLowerCase()
      ).join(' ');
      if (!toEmails.includes(filters.to.toLowerCase())) {
        return false;
      }
    }

    if (filters.subject && !(email.subject || '').toLowerCase().includes(filters.subject.toLowerCase())) {
      return false;
    }

    if (filters.body && !(email.body_text || '').toLowerCase().includes(filters.body.toLowerCase())) {
      return false;
    }

    if (filters.hasAttachment !== undefined && email.has_attachments !== filters.hasAttachment) {
      return false;
    }

    if (filters.filename && email.attachments) {
      const hasMatchingFilename = email.attachments.some((att: any) => 
        att.filename?.toLowerCase().includes(filters.filename!.toLowerCase())
      );
      if (!hasMatchingFilename) {
        return false;
      }
    }

    if (filters.minSize !== undefined) {
      const size = email.body_text?.length || 0;
      if (size < filters.minSize) {
        return false;
      }
    }

    if (filters.maxSize !== undefined) {
      const size = email.body_text?.length || 0;
      if (size > filters.maxSize) {
        return false;
      }
    }

    if (filters.afterDate) {
      const emailDate = new Date(email.received_at);
      if (emailDate < filters.afterDate) {
        return false;
      }
    }

    if (filters.beforeDate) {
      const emailDate = new Date(email.received_at);
      if (emailDate > filters.beforeDate) {
        return false;
      }
    }

    if (filters.isUnread !== undefined && email.is_read === filters.isUnread) {
      return false;
    }

    if (filters.isRead !== undefined && email.is_read !== filters.isRead) {
      return false;
    }

    if (filters.isStarred !== undefined && email.is_starred !== filters.isStarred) {
      return false;
    }

    if (filters.isImportant !== undefined && email.is_important !== filters.isImportant) {
      return false;
    }

    if (filters.category && email.ai_category !== filters.category) {
      return false;
    }

    // Check negated filters
    if (filters.negateFilters) {
      const negMatch = this.matchesFilters(email, filters.negateFilters as SearchFilters);
      if (negMatch) {
        return false; // Email matches negated filter, so exclude it
      }
    }

    return true;
  }

  /**
   * Generate autocomplete suggestions for search query
   */
  getAutocompleteSuggestions(partial: string): string[] {
    const suggestions: string[] = [];
    const lowerPartial = partial.toLowerCase();

    // Suggest operators
    const operators = Object.keys(this.operatorMap);
    for (const op of operators) {
      if (op.startsWith(lowerPartial)) {
        suggestions.push(`${op}:`);
      }
    }

    // Suggest common values for specific operators
    if (lowerPartial.includes('is:')) {
      const statuses = ['unread', 'read', 'starred', 'important'];
      suggestions.push(...statuses.map(s => `is:${s}`));
    }

    if (lowerPartial.includes('has:')) {
      suggestions.push('has:attachment', 'has:link');
    }

    if (lowerPartial.includes('in:')) {
      const folders = ['inbox', 'sent', 'drafts', 'starred', 'trash', 'spam'];
      suggestions.push(...folders.map(f => `in:${f}`));
    }

    return suggestions.slice(0, 10); // Limit to 10 suggestions
  }
}

// Singleton instance
export const searchQueryParser = new SearchQueryParser();
export default searchQueryParser;
