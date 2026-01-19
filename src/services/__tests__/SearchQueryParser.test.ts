import { describe, it, expect } from 'vitest';
import searchQueryParser from '../searchQueryParser';

describe('SearchQueryParser', () => {
  const parseFilters = (query: string) => searchQueryParser.toFilters(searchQueryParser.parse(query));

  it('parses free text', () => {
    const parsed = searchQueryParser.parse('hello world');
    expect(parsed.freeText).toContain('hello');
    expect(parsed.freeText).toContain('world');
  });

  it('parses from operator', () => {
    const filters = parseFilters('from:john@example.com');
    expect(filters.from).toBe('john@example.com');
  });

  it('parses subject with quotes', () => {
    const filters = parseFilters('subject:"monthly report"');
    expect(filters.subject).toBe('monthly report');
  });

  it('parses has:attachment', () => {
    const filters = parseFilters('has:attachment');
    expect(filters.hasAttachment).toBe(true);
  });

  it('parses is:unread and is:read', () => {
    expect(parseFilters('is:unread').isUnread).toBe(true);
    expect(parseFilters('is:read').isRead).toBe(true);
  });

  it('parses size operators', () => {
    const larger = parseFilters('larger:10MB');
    const smaller = parseFilters('smaller:1KB');
    expect(larger.minSize).toBe(10 * 1024 * 1024);
    expect(smaller.maxSize).toBe(1024);
  });

  it('parses date operators', () => {
    const filters = parseFilters('after:2024/01/01 before:2024/12/31');
    expect(filters.afterDate).toBeInstanceOf(Date);
    expect(filters.beforeDate).toBeInstanceOf(Date);
  });

  it('parses label and negation', () => {
    const filters = parseFilters('label:important -from:spam@example.com');
    expect(filters.label).toBe('important');
    expect(filters.negateFilters?.from).toBe('spam@example.com');
  });

  it('matches filters against an email', () => {
    const email = {
      from_email: 'john@example.com',
      to_emails: [{ email: 'me@example.com' }],
      subject: 'Monthly Report',
      body_text: 'Here is the report',
      has_attachments: true,
      attachments: [{ filename: 'report.pdf' }],
      is_read: false,
      is_starred: false,
      is_important: false,
      ai_category: null,
      received_at: new Date('2024-02-01').toISOString(),
    } as any;

    const filters = parseFilters('from:john@example.com subject:report has:attachment is:unread');
    expect(searchQueryParser.matchesFilters(email, filters)).toBe(true);
  });

  it('provides autocomplete suggestions', () => {
    const suggestions = searchQueryParser.getAutocompleteSuggestions('is:');
    expect(suggestions).toContain('is:unread');
  });
});
