/**
 * File Security Service Tests
 *
 * Tests for file validation, magic number checking, and security scanning
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { fileSecurityService } from '../fileSecurityService';

// Helper to create mock File objects
function createMockFile(
  name: string,
  type: string,
  content: Uint8Array,
  size?: number
): File {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });

  // Override size if specified
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size });
  }

  return file;
}

describe('FileSecurityService', () => {
  describe('file type validation', () => {
    it('should accept valid JPEG files', async () => {
      const jpegMagicNumber = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const file = createMockFile('photo.jpg', 'image/jpeg', jpegMagicNumber);

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.fileInfo.category).toBe('image');
    });

    it('should accept valid PNG files', async () => {
      const pngMagicNumber = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const file = createMockFile('image.png', 'image/png', pngMagicNumber);

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(true);
      expect(result.fileInfo.category).toBe('image');
    });

    it('should accept valid PDF files', async () => {
      const pdfMagicNumber = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
      const file = createMockFile('document.pdf', 'application/pdf', pdfMagicNumber);

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(true);
      expect(result.fileInfo.category).toBe('document');
    });

    it('should accept valid MP3 files', async () => {
      const mp3MagicNumber = new Uint8Array([0x49, 0x44, 0x33]); // ID3
      const file = createMockFile('song.mp3', 'audio/mpeg', mp3MagicNumber);

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(true);
      expect(result.fileInfo.category).toBe('audio');
    });

    it('should accept valid MP4 files', async () => {
      const mp4MagicNumber = new Uint8Array([
        0x00, 0x00, 0x00, 0x20,
        0x66, 0x74, 0x79, 0x70, // ftyp at offset 4
      ]);
      const file = createMockFile('video.mp4', 'video/mp4', mp4MagicNumber);

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(true);
      expect(result.fileInfo.category).toBe('video');
    });
  });

  describe('dangerous file rejection', () => {
    it('should reject executable files', async () => {
      const file = createMockFile('malware.exe', 'application/x-msdownload', new Uint8Array([0x4d, 0x5a]));

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('not allowed'));
    });

    it('should reject script files', async () => {
      const file = createMockFile('script.js', 'text/javascript', new Uint8Array([0x63, 0x6f, 0x6e, 0x73]));

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('not allowed'));
    });

    it('should reject batch files', async () => {
      const file = createMockFile('script.bat', 'application/bat', new Uint8Array([0x40, 0x65, 0x63, 0x68]));

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('not allowed'));
    });

    it('should reject DLL files', async () => {
      const file = createMockFile('library.dll', 'application/x-msdownload', new Uint8Array([0x4d, 0x5a]));

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(false);
    });
  });

  describe('magic number validation', () => {
    it('should detect mismatched file signatures', async () => {
      // File claims to be PNG but has JPEG signature
      const jpegMagicNumber = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const file = createMockFile('fake.png', 'image/png', jpegMagicNumber);

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('signature does not match'));
    });

    it('should detect renamed executables', async () => {
      // Executable renamed to .jpg
      const exeMagicNumber = new Uint8Array([0x4d, 0x5a]); // MZ header
      const file = createMockFile('image.jpg', 'image/jpeg', exeMagicNumber);

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('signature does not match'));
    });

    it('should validate GIF87a signature', async () => {
      const gif87Magic = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]); // GIF87a
      const file = createMockFile('animation.gif', 'image/gif', gif87Magic);

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(true);
    });

    it('should validate GIF89a signature', async () => {
      const gif89Magic = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
      const file = createMockFile('animation.gif', 'image/gif', gif89Magic);

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(true);
    });

    it('should validate ZIP signature', async () => {
      const zipMagic = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // PK
      const file = createMockFile('archive.zip', 'application/zip', zipMagic);

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(true);
    });
  });

  describe('file size validation', () => {
    it('should reject files exceeding size limits', async () => {
      const jpegMagicNumber = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const file = createMockFile(
        'huge.jpg',
        'image/jpeg',
        jpegMagicNumber,
        20 * 1024 * 1024 // 20MB (exceeds 10MB limit)
      );

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('exceeds maximum'));
    });

    it('should accept files within size limits', async () => {
      const pngMagicNumber = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const file = createMockFile(
        'small.png',
        'image/png',
        pngMagicNumber,
        2 * 1024 * 1024 // 2MB (within 10MB limit)
      );

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(true);
    });

    it('should reject zero-byte files', async () => {
      const file = createMockFile('empty.txt', 'text/plain', new Uint8Array([]), 0);

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('empty'));
    });

    it('should have stricter limits for SVG files', async () => {
      const file = createMockFile(
        'large.svg',
        'image/svg+xml',
        new Uint8Array([0x3c, 0x73, 0x76, 0x67]), // <svg
        5 * 1024 * 1024 // 5MB (exceeds 1MB SVG limit)
      );

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('exceeds maximum'));
    });
  });

  describe('filename validation', () => {
    it('should sanitize dangerous filenames', async () => {
      const jpegMagicNumber = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const file = createMockFile(
        '<script>alert("XSS")</script>.jpg',
        'image/jpeg',
        jpegMagicNumber
      );

      const result = await fileSecurityService.validateFile(file);

      expect(result.warnings).toContain(expect.stringContaining('sanitized'));
      expect(result.fileInfo.name).not.toContain('<script>');
    });

    it('should reject filenames with path traversal', async () => {
      const file = createMockFile(
        '../../../etc/passwd.jpg',
        'image/jpeg',
        new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
      );

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('suspicious'));
    });

    it('should reject double extensions', async () => {
      const file = createMockFile(
        'document.pdf.exe',
        'application/pdf',
        new Uint8Array([0x25, 0x50, 0x44, 0x46])
      );

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('not allowed'));
    });

    it('should reject .htaccess files', async () => {
      const file = createMockFile('.htaccess', 'text/plain', new Uint8Array([0x41]));

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(false);
    });
  });

  describe('SVG security validation', () => {
    it('should reject SVG with script tags', async () => {
      const svgContent = '<svg><script>alert("XSS")</script></svg>';
      const file = createMockFile(
        'image.svg',
        'image/svg+xml',
        new TextEncoder().encode(svgContent)
      );

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('<script> tags'));
    });

    it('should reject SVG with event handlers', async () => {
      const svgContent = '<svg onload="alert(\'XSS\')"><rect /></svg>';
      const file = createMockFile(
        'image.svg',
        'image/svg+xml',
        new TextEncoder().encode(svgContent)
      );

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('event handlers'));
    });

    it('should reject SVG with javascript: URLs', async () => {
      const svgContent = '<svg><a href="javascript:alert(\'XSS\')">Click</a></svg>';
      const file = createMockFile(
        'image.svg',
        'image/svg+xml',
        new TextEncoder().encode(svgContent)
      );

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('dangerous external references'));
    });

    it('should reject SVG with foreignObject', async () => {
      const svgContent = '<svg><foreignObject><body>Content</body></foreignObject></svg>';
      const file = createMockFile(
        'image.svg',
        'image/svg+xml',
        new TextEncoder().encode(svgContent)
      );

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('foreignObject'));
    });

    it('should accept safe SVG files', async () => {
      const svgContent = '<svg><rect width="100" height="100" fill="blue"/></svg>';
      const file = createMockFile(
        'image.svg',
        'image/svg+xml',
        new TextEncoder().encode(svgContent)
      );

      const result = await fileSecurityService.validateFile(file);

      expect(result.valid).toBe(true);
    });
  });

  describe('MIME type validation', () => {
    it('should warn when MIME type does not match extension', async () => {
      const jpegMagicNumber = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const file = createMockFile(
        'image.jpg',
        'image/png', // Wrong MIME type
        jpegMagicNumber
      );

      const result = await fileSecurityService.validateFile(file);

      expect(result.warnings).toContain(
        expect.stringContaining('MIME type')
      );
    });

    it('should accept matching MIME types', async () => {
      const pdfMagicNumber = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      const file = createMockFile('document.pdf', 'application/pdf', pdfMagicNumber);

      const result = await fileSecurityService.validateFile(file);

      expect(result.warnings).not.toContain(expect.stringContaining('MIME type'));
    });
  });

  describe('file category detection', () => {
    it('should categorize images correctly', async () => {
      const jpegMagic = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const file = createMockFile('photo.jpg', 'image/jpeg', jpegMagic);

      const result = await fileSecurityService.validateFile(file);

      expect(result.fileInfo.category).toBe('image');
    });

    it('should categorize documents correctly', async () => {
      const pdfMagic = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      const file = createMockFile('doc.pdf', 'application/pdf', pdfMagic);

      const result = await fileSecurityService.validateFile(file);

      expect(result.fileInfo.category).toBe('document');
    });

    it('should categorize audio files correctly', async () => {
      const mp3Magic = new Uint8Array([0x49, 0x44, 0x33]);
      const file = createMockFile('song.mp3', 'audio/mpeg', mp3Magic);

      const result = await fileSecurityService.validateFile(file);

      expect(result.fileInfo.category).toBe('audio');
    });

    it('should categorize video files correctly', async () => {
      const mp4Magic = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]);
      const file = createMockFile('video.mp4', 'video/mp4', mp4Magic);

      const result = await fileSecurityService.validateFile(file);

      expect(result.fileInfo.category).toBe('video');
    });

    it('should categorize archives correctly', async () => {
      const zipMagic = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
      const file = createMockFile('archive.zip', 'application/zip', zipMagic);

      const result = await fileSecurityService.validateFile(file);

      expect(result.fileInfo.category).toBe('archive');
    });
  });

  describe('comprehensive validation', () => {
    it('should perform all validation checks', async () => {
      const jpegMagic = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const file = createMockFile('photo.jpg', 'image/jpeg', jpegMagic, 1024 * 1024);

      const result = await fileSecurityService.validateFileComprehensive(file, false);

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('fileInfo');
    });

    it('should include virus scan when requested', async () => {
      const jpegMagic = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const file = createMockFile('photo.jpg', 'image/jpeg', jpegMagic);

      const result = await fileSecurityService.validateFileComprehensive(file, true);

      // Virus scan is a placeholder, should still return valid for clean files
      expect(result.valid).toBe(true);
    });
  });

  describe('utility methods', () => {
    it('should return allowed file types', () => {
      const allowedTypes = fileSecurityService.getAllowedFileTypes();

      expect(allowedTypes).toContain('JPEG Image');
      expect(allowedTypes).toContain('PNG Image');
      expect(allowedTypes).toContain('PDF Document');
    });

    it('should return allowed extensions', () => {
      const allowedExtensions = fileSecurityService.getAllowedExtensions();

      expect(allowedExtensions).toContain('jpg');
      expect(allowedExtensions).toContain('png');
      expect(allowedExtensions).toContain('pdf');
      expect(allowedExtensions).not.toContain('exe');
    });

    it('should return max file size for extension', () => {
      const maxSize = fileSecurityService.getMaxFileSize('jpg');

      expect(maxSize).toBeGreaterThan(0);
      expect(maxSize).toBe(10 * 1024 * 1024); // 10MB for JPEG
    });

    it('should return 0 for unknown extension', () => {
      const maxSize = fileSecurityService.getMaxFileSize('unknown');

      expect(maxSize).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle files without extensions', async () => {
      const file = createMockFile('README', 'text/plain', new Uint8Array([0x41]));

      const result = await fileSecurityService.validateFile(file);

      // Should fail validation due to missing extension
      expect(result.valid).toBe(false);
    });

    it('should handle very long filenames', async () => {
      const longName = 'a'.repeat(300) + '.jpg';
      const jpegMagic = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const file = createMockFile(longName, 'image/jpeg', jpegMagic);

      const result = await fileSecurityService.validateFile(file);

      // Filename should be sanitized/truncated
      expect(result.fileInfo.name.length).toBeLessThanOrEqual(255);
    });

    it('should handle multiple file types with same magic number', async () => {
      // ZIP and DOCX share the same magic number (PK)
      const zipMagic = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
      const docxFile = createMockFile('document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', zipMagic);

      const result = await fileSecurityService.validateFile(docxFile);

      expect(result.valid).toBe(true);
    });
  });
});
