/**
 * Sanitization Service Tests
 *
 * Tests for XSS prevention, SQL injection detection, and input sanitization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizationService } from '../sanitizationService';

describe('SanitizationService', () => {
  describe('sanitizeHtml', () => {
    it('should allow safe HTML tags', () => {
      const html = '<p>Hello <strong>world</strong>!</p>';
      const result = sanitizationService.sanitizeHtml(html);

      expect(result.sanitized).toContain('<p>');
      expect(result.sanitized).toContain('<strong>');
      expect(result.valid).toBe(true);
      expect(result.changed).toBe(false);
    });

    it('should remove script tags', () => {
      const html = '<p>Hello</p><script>alert("XSS")</script>';
      const result = sanitizationService.sanitizeHtml(html);

      expect(result.sanitized).not.toContain('<script>');
      expect(result.sanitized).not.toContain('alert');
      expect(result.warnings).toContain(expect.stringContaining('script'));
    });

    it('should remove event handlers', () => {
      const html = '<p onclick="alert(\'XSS\')">Click me</p>';
      const result = sanitizationService.sanitizeHtml(html);

      expect(result.sanitized).not.toContain('onclick');
      expect(result.sanitized).not.toContain('alert');
    });

    it('should remove javascript: URLs', () => {
      const html = '<a href="javascript:alert(\'XSS\')">Click</a>';
      const result = sanitizationService.sanitizeHtml(html);

      expect(result.sanitized).not.toContain('javascript:');
      expect(result.warnings).toContain(expect.stringContaining('javascript:'));
    });

    it('should remove iframe tags', () => {
      const html = '<p>Content</p><iframe src="evil.com"></iframe>';
      const result = sanitizationService.sanitizeHtml(html);

      expect(result.sanitized).not.toContain('<iframe');
      expect(result.warnings).toContain(expect.stringContaining('iframe'));
    });

    it('should enforce content length limits', () => {
      const longHtml = '<p>' + 'a'.repeat(1000) + '</p>';
      const result = sanitizationService.sanitizeHtml(longHtml, { maxLength: 100 });

      expect(result.sanitized.length).toBeLessThanOrEqual(100);
      expect(result.warnings).toContain(expect.stringContaining('truncated'));
    });

    it('should use strict mode for sensitive content', () => {
      const html = '<div class="test"><img src="image.jpg" /></div>';
      const result = sanitizationService.sanitizeHtml(html, { level: 'strict' });

      // Strict mode allows fewer tags
      expect(result.sanitized).not.toContain('<div');
      expect(result.sanitized).not.toContain('<img');
    });

    it('should allow more tags in relaxed mode', () => {
      const html = '<div class="container"><table><tr><td>Data</td></tr></table></div>';
      const result = sanitizationService.sanitizeHtml(html, { level: 'relaxed' });

      expect(result.sanitized).toContain('<div');
      expect(result.sanitized).toContain('<table');
    });

    it('should track removed elements', () => {
      const html = '<p>Text</p><script>bad</script><style>css</style>';
      const result = sanitizationService.sanitizeHtml(html);

      expect(result.removedElements).toContain('script');
    });
  });

  describe('sanitizeText', () => {
    it('should remove all HTML tags', () => {
      const text = '<p>Hello <strong>world</strong>!</p>';
      const result = sanitizationService.sanitizeText(text);

      expect(result).toBe('Hello world !');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should decode HTML entities', () => {
      const text = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;';
      const result = sanitizationService.sanitizeText(text);

      // Should decode entities but remove tags
      expect(result).not.toContain('&lt;');
      expect(result).not.toContain('&gt;');
    });

    it('should remove control characters', () => {
      const text = 'Hello\x00\x01\x02World';
      const result = sanitizationService.sanitizeText(text);

      expect(result).toBe('HelloWorld');
    });

    it('should normalize whitespace', () => {
      const text = 'Hello    \n\n   world   \t\t  !';
      const result = sanitizationService.sanitizeText(text);

      expect(result).toBe('Hello world !');
    });

    it('should enforce length limits', () => {
      const text = 'a'.repeat(200);
      const result = sanitizationService.sanitizeText(text, { maxLength: 50 });

      expect(result.length).toBe(50);
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow valid HTTP URLs', () => {
      const url = 'https://example.com/path?query=value';
      const result = sanitizationService.sanitizeUrl(url);

      expect(result).toBe(url);
    });

    it('should allow valid HTTPS URLs', () => {
      const url = 'https://secure.example.com';
      const result = sanitizationService.sanitizeUrl(url);

      expect(result).toBe(url);
    });

    it('should allow mailto URLs', () => {
      const url = 'mailto:user@example.com';
      const result = sanitizationService.sanitizeUrl(url);

      expect(result).toBe(url);
    });

    it('should block javascript: URLs', () => {
      const url = 'javascript:alert("XSS")';
      const result = sanitizationService.sanitizeUrl(url);

      expect(result).toBeNull();
    });

    it('should block data: URLs', () => {
      const url = 'data:text/html,<script>alert("XSS")</script>';
      const result = sanitizationService.sanitizeUrl(url);

      expect(result).toBeNull();
    });

    it('should block vbscript: URLs', () => {
      const url = 'vbscript:msgbox("XSS")';
      const result = sanitizationService.sanitizeUrl(url);

      expect(result).toBeNull();
    });

    it('should block file: URLs', () => {
      const url = 'file:///etc/passwd';
      const result = sanitizationService.sanitizeUrl(url);

      expect(result).toBeNull();
    });

    it('should allow relative paths', () => {
      const url = '/path/to/page';
      const result = sanitizationService.sanitizeUrl(url);

      expect(result).toBe(url);
    });

    it('should block paths with path traversal', () => {
      const url = '/path/../../etc/passwd';
      const result = sanitizationService.sanitizeUrl(url);

      expect(result).toBeNull();
    });

    it('should handle invalid URLs', () => {
      const url = 'not a url';
      const result = sanitizationService.sanitizeUrl(url);

      expect(result).toBeNull();
    });
  });

  describe('sanitizeFilePath', () => {
    it('should allow safe file paths', () => {
      const path = 'documents/file.pdf';
      const result = sanitizationService.sanitizeFilePath(path);

      expect(result).toBe('documents/file.pdf');
    });

    it('should block path traversal with ../', () => {
      const path = '../../../etc/passwd';
      const result = sanitizationService.sanitizeFilePath(path);

      expect(result).toBeNull();
    });

    it('should block path traversal with ..\\', () => {
      const path = '..\\..\\windows\\system32';
      const result = sanitizationService.sanitizeFilePath(path);

      expect(result).toBeNull();
    });

    it('should block encoded path traversal', () => {
      const path = '%2e%2e%2fpasswd';
      const result = sanitizationService.sanitizeFilePath(path);

      expect(result).toBeNull();
    });

    it('should remove null bytes', () => {
      const path = 'file.txt\x00.jpg';
      const result = sanitizationService.sanitizeFilePath(path);

      expect(result).toBe('file.txt.jpg');
    });

    it('should normalize path separators', () => {
      const path = 'path\\to\\file.txt';
      const result = sanitizationService.sanitizeFilePath(path);

      expect(result).toBe('path/to/file.txt');
    });
  });

  describe('SQL injection detection', () => {
    it('should detect SQL SELECT statements', () => {
      const input = "'; SELECT * FROM users; --";
      const result = sanitizationService.detectSqlInjection(input);

      expect(result).toBe(true);
    });

    it('should detect SQL UNION attacks', () => {
      const input = "' UNION SELECT password FROM users--";
      const result = sanitizationService.detectSqlInjection(input);

      expect(result).toBe(true);
    });

    it('should detect SQL DROP statements', () => {
      const input = "'; DROP TABLE users; --";
      const result = sanitizationService.detectSqlInjection(input);

      expect(result).toBe(true);
    });

    it('should detect SQL OR 1=1 attacks', () => {
      const input = "' OR '1'='1";
      const result = sanitizationService.detectSqlInjection(input);

      expect(result).toBe(true);
    });

    it('should allow safe input', () => {
      const input = 'John Doe';
      const result = sanitizationService.detectSqlInjection(input);

      expect(result).toBe(false);
    });
  });

  describe('sanitizeSqlInput', () => {
    it('should escape single quotes', () => {
      const input = "O'Brien";
      const result = sanitizationService.sanitizeSqlInput(input);

      expect(result).toBe("O''Brien");
    });

    it('should remove SQL keywords', () => {
      const input = 'SELECT * FROM users';
      const result = sanitizationService.sanitizeSqlInput(input);

      expect(result).not.toContain('SELECT');
      expect(result).not.toContain('FROM');
    });

    it('should remove SQL comment markers', () => {
      const input = 'test --comment';
      const result = sanitizationService.sanitizeSqlInput(input);

      expect(result).not.toContain('--');
    });
  });

  describe('sanitizeEmail', () => {
    it('should allow valid email addresses', () => {
      const email = 'user@example.com';
      const result = sanitizationService.sanitizeEmail(email);

      expect(result).toBe('user@example.com');
    });

    it('should lowercase email addresses', () => {
      const email = 'User@Example.COM';
      const result = sanitizationService.sanitizeEmail(email);

      expect(result).toBe('user@example.com');
    });

    it('should reject invalid email format', () => {
      const email = 'not-an-email';
      const result = sanitizationService.sanitizeEmail(email);

      expect(result).toBeNull();
    });

    it('should reject emails with dangerous characters', () => {
      const email = 'user<script>@example.com';
      const result = sanitizationService.sanitizeEmail(email);

      expect(result).toBeNull();
    });

    it('should handle email with plus addressing', () => {
      const email = 'user+tag@example.com';
      const result = sanitizationService.sanitizeEmail(email);

      expect(result).toBe('user+tag@example.com');
    });
  });

  describe('sanitizePhoneNumber', () => {
    it('should keep digits and leading plus sign', () => {
      const phone = '+1 (555) 123-4567';
      const result = sanitizationService.sanitizePhoneNumber(phone);

      expect(result).toBe('+15551234567');
    });

    it('should remove all non-digit characters except leading plus', () => {
      const phone = '555-123-4567 ext 123';
      const result = sanitizationService.sanitizePhoneNumber(phone);

      expect(result).toBe('5551234567123');
    });

    it('should preserve international format', () => {
      const phone = '+44 20 1234 5678';
      const result = sanitizationService.sanitizePhoneNumber(phone);

      expect(result).toBe('+442012345678');
    });

    it('should remove multiple plus signs except first', () => {
      const phone = '+1+555+1234';
      const result = sanitizationService.sanitizePhoneNumber(phone);

      expect(result).toBe('+15551234');
    });
  });

  describe('sanitizeFilename', () => {
    it('should allow safe filenames', () => {
      const filename = 'document.pdf';
      const result = sanitizationService.sanitizeFilename(filename);

      expect(result).toBe('document.pdf');
    });

    it('should remove path separators', () => {
      const filename = 'path/to/file.txt';
      const result = sanitizationService.sanitizeFilename(filename);

      expect(result).toBe('pathtofile.txt');
    });

    it('should remove dangerous characters', () => {
      const filename = 'file<>:"|?*.txt';
      const result = sanitizationService.sanitizeFilename(filename);

      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain('|');
    });

    it('should limit filename length', () => {
      const filename = 'a'.repeat(300) + '.txt';
      const result = sanitizationService.sanitizeFilename(filename);

      expect(result.length).toBeLessThanOrEqual(255);
      expect(result).toContain('.txt');
    });

    it('should provide default name for empty input', () => {
      const filename = '';
      const result = sanitizationService.sanitizeFilename(filename);

      expect(result).toBe('unnamed');
    });
  });

  describe('sanitizeMessageContent', () => {
    it('should sanitize text messages by default', () => {
      const content = '<script>alert("XSS")</script>Hello';
      const result = sanitizationService.sanitizeMessageContent(content);

      expect(result).not.toContain('<script>');
      expect(result).toContain('Hello');
    });

    it('should allow HTML when specified', () => {
      const content = '<p>Hello <strong>world</strong></p>';
      const result = sanitizationService.sanitizeMessageContent(content, true);

      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
    });

    it('should enforce message length limit', () => {
      const content = 'a'.repeat(15000);
      const result = sanitizationService.sanitizeMessageContent(content);

      expect(result.length).toBeLessThanOrEqual(10000);
    });
  });

  describe('sanitizeUserProfile', () => {
    it('should sanitize all profile fields', () => {
      const profile = {
        name: '<script>XSS</script>John Doe',
        email: 'User@Example.COM',
        bio: 'Software developer',
        phone: '+1 (555) 123-4567',
        avatar: 'https://example.com/avatar.jpg',
      };

      const result = sanitizationService.sanitizeUserProfile(profile);

      expect(result.name).not.toContain('<script>');
      expect(result.email).toBe('user@example.com');
      expect(result.bio).toBe('Software developer');
      expect(result.phone).toBe('+15551234567');
      expect(result.avatar).toBe('https://example.com/avatar.jpg');
    });

    it('should reject invalid email in profile', () => {
      const profile = {
        name: 'John Doe',
        email: 'invalid-email',
      };

      const result = sanitizationService.sanitizeUserProfile(profile);

      expect(result.email).toBeNull();
    });

    it('should enforce length limits on bio', () => {
      const profile = {
        bio: 'a'.repeat(1000),
      };

      const result = sanitizationService.sanitizeUserProfile(profile);

      expect(result.bio.length).toBeLessThanOrEqual(500);
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize all string values recursively', () => {
      const obj = {
        title: '<script>XSS</script>Title',
        description: '<p>Description</p>',
        nested: {
          value: '<b>Bold</b>',
        },
      };

      const result = sanitizationService.sanitizeObject(obj);

      expect(result.title).not.toContain('<script>');
      expect(result.description).not.toContain('<p>');
      expect(result.nested.value).not.toContain('<b>');
    });

    it('should preserve non-string values', () => {
      const obj = {
        number: 42,
        boolean: true,
        nullValue: null,
        undefinedValue: undefined,
      };

      const result = sanitizationService.sanitizeObject(obj);

      expect(result.number).toBe(42);
      expect(result.boolean).toBe(true);
      expect(result.nullValue).toBeNull();
      expect(result.undefinedValue).toBeUndefined();
    });

    it('should sanitize arrays', () => {
      const obj = {
        tags: ['<script>tag1</script>', 'tag2', '<b>tag3</b>'],
      };

      const result = sanitizationService.sanitizeObject(obj);

      expect(result.tags[0]).not.toContain('<script>');
      expect(result.tags[1]).toBe('tag2');
      expect(result.tags[2]).not.toContain('<b>');
    });

    it('should sanitize object keys', () => {
      const obj = {
        '<script>key</script>': 'value',
      };

      const result = sanitizationService.sanitizeObject(obj);

      const keys = Object.keys(result);
      expect(keys[0]).not.toContain('<script>');
    });
  });

  describe('sanitizeJsonInput', () => {
    it('should parse and sanitize valid JSON', () => {
      const json = '{"name":"<script>XSS</script>John","age":30}';
      const result = sanitizationService.sanitizeJsonInput(json);

      expect(result).toBeDefined();
      expect(result.name).not.toContain('<script>');
      expect(result.age).toBe(30);
    });

    it('should return null for invalid JSON', () => {
      const json = '{invalid json}';
      const result = sanitizationService.sanitizeJsonInput(json);

      expect(result).toBeNull();
    });

    it('should sanitize nested JSON objects', () => {
      const json = '{"user":{"name":"<b>Test</b>","email":"test@example.com"}}';
      const result = sanitizationService.sanitizeJsonInput(json);

      expect(result.user.name).not.toContain('<b>');
      expect(result.user.email).toBe('test@example.com');
    });
  });

  describe('createSafePreview', () => {
    it('should create safe preview of content', () => {
      const content = '<script>XSS</script>This is a long text that needs to be previewed';
      const result = sanitizationService.createSafePreview(content, 20);

      expect(result).not.toContain('<script>');
      expect(result.length).toBeLessThanOrEqual(23); // 20 + '...'
      expect(result).toContain('...');
    });

    it('should not add ellipsis for short content', () => {
      const content = 'Short text';
      const result = sanitizationService.createSafePreview(content, 50);

      expect(result).toBe('Short text');
      expect(result).not.toContain('...');
    });
  });

  describe('security edge cases', () => {
    it('should handle multiple XSS attempts', () => {
      const malicious = `
        <img src=x onerror=alert('XSS')>
        <svg onload=alert('XSS')>
        <iframe src="javascript:alert('XSS')"></iframe>
        <object data="javascript:alert('XSS')"></object>
      `;

      const result = sanitizationService.sanitizeHtml(malicious);

      expect(result.sanitized).not.toContain('onerror');
      expect(result.sanitized).not.toContain('onload');
      expect(result.sanitized).not.toContain('javascript:');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle HTML entity encoded attacks', () => {
      const encoded = '&#60;script&#62;alert(&#34;XSS&#34;)&#60;/script&#62;';
      const result = sanitizationService.sanitizeText(encoded);

      expect(result).not.toContain('script');
      expect(result).not.toContain('alert');
    });

    it('should handle Unicode bypass attempts', () => {
      const unicode = '<img src=x onerror=alert(\u0027XSS\u0027)>';
      const result = sanitizationService.sanitizeHtml(unicode);

      expect(result.sanitized).not.toContain('onerror');
      expect(result.sanitized).not.toContain('alert');
    });
  });
});
