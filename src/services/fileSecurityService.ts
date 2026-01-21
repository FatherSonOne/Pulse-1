/**
 * File Security Service
 *
 * CRITICAL SECURITY - P0 Priority
 *
 * Comprehensive file upload validation and security checks to prevent
 * malicious file uploads, validate file types, and scan for threats.
 *
 * Security Features:
 * - File type whitelist validation
 * - Magic number (file signature) validation
 * - File size limits
 * - Malicious filename detection
 * - MIME type validation
 * - File extension validation
 * - Virus scanning placeholder
 * - Content Security Policy compliance
 */

import { sanitizationService } from './sanitizationService';

// ==================== Types ====================

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo: {
    name: string;
    size: number;
    type: string;
    extension: string;
    category: FileCategory;
  };
}

export type FileCategory = 'image' | 'document' | 'archive' | 'audio' | 'video' | 'unknown';

export interface FileTypeConfig {
  extensions: string[];
  mimeTypes: string[];
  magicNumbers: Array<{ offset: number; bytes: number[] }>;
  maxSize: number;
  description: string;
}

// ==================== File Type Configurations ====================

/**
 * Comprehensive file type whitelist with magic numbers
 * Magic numbers (file signatures) help detect actual file type regardless of extension
 */
const FILE_TYPE_CONFIGS: Record<string, FileTypeConfig> = {
  // Images
  jpg: {
    extensions: ['jpg', 'jpeg'],
    mimeTypes: ['image/jpeg'],
    magicNumbers: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
    maxSize: 10 * 1024 * 1024, // 10MB
    description: 'JPEG Image',
  },
  png: {
    extensions: ['png'],
    mimeTypes: ['image/png'],
    magicNumbers: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }],
    maxSize: 10 * 1024 * 1024, // 10MB
    description: 'PNG Image',
  },
  gif: {
    extensions: ['gif'],
    mimeTypes: ['image/gif'],
    magicNumbers: [
      { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
      { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
    ],
    maxSize: 5 * 1024 * 1024, // 5MB
    description: 'GIF Image',
  },
  webp: {
    extensions: ['webp'],
    mimeTypes: ['image/webp'],
    magicNumbers: [{ offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }], // "WEBP" at offset 8
    maxSize: 10 * 1024 * 1024, // 10MB
    description: 'WebP Image',
  },
  svg: {
    extensions: ['svg'],
    mimeTypes: ['image/svg+xml'],
    magicNumbers: [], // SVG is XML, no magic number
    maxSize: 1 * 1024 * 1024, // 1MB (smaller due to security concerns)
    description: 'SVG Image',
  },

  // Documents
  pdf: {
    extensions: ['pdf'],
    mimeTypes: ['application/pdf'],
    magicNumbers: [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
    maxSize: 20 * 1024 * 1024, // 20MB
    description: 'PDF Document',
  },
  doc: {
    extensions: ['doc'],
    mimeTypes: ['application/msword'],
    magicNumbers: [{ offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0] }], // MS Office
    maxSize: 10 * 1024 * 1024, // 10MB
    description: 'Microsoft Word Document',
  },
  docx: {
    extensions: ['docx'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    magicNumbers: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }], // ZIP format
    maxSize: 10 * 1024 * 1024, // 10MB
    description: 'Microsoft Word Document (OOXML)',
  },
  txt: {
    extensions: ['txt'],
    mimeTypes: ['text/plain'],
    magicNumbers: [], // Plain text has no magic number
    maxSize: 5 * 1024 * 1024, // 5MB
    description: 'Plain Text File',
  },
  md: {
    extensions: ['md', 'markdown'],
    mimeTypes: ['text/markdown', 'text/plain'],
    magicNumbers: [],
    maxSize: 2 * 1024 * 1024, // 2MB
    description: 'Markdown File',
  },

  // Archives
  zip: {
    extensions: ['zip'],
    mimeTypes: ['application/zip'],
    magicNumbers: [
      { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }, // Standard ZIP
      { offset: 0, bytes: [0x50, 0x4b, 0x05, 0x06] }, // Empty ZIP
    ],
    maxSize: 50 * 1024 * 1024, // 50MB
    description: 'ZIP Archive',
  },

  // Audio
  mp3: {
    extensions: ['mp3'],
    mimeTypes: ['audio/mpeg'],
    magicNumbers: [
      { offset: 0, bytes: [0x49, 0x44, 0x33] }, // ID3
      { offset: 0, bytes: [0xff, 0xfb] }, // MPEG-1 Layer 3
    ],
    maxSize: 20 * 1024 * 1024, // 20MB
    description: 'MP3 Audio',
  },
  wav: {
    extensions: ['wav'],
    mimeTypes: ['audio/wav', 'audio/x-wav'],
    magicNumbers: [{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }], // RIFF
    maxSize: 20 * 1024 * 1024, // 20MB
    description: 'WAV Audio',
  },
  m4a: {
    extensions: ['m4a'],
    mimeTypes: ['audio/mp4', 'audio/x-m4a'],
    magicNumbers: [{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }], // ftyp
    maxSize: 20 * 1024 * 1024, // 20MB
    description: 'M4A Audio',
  },

  // Video
  mp4: {
    extensions: ['mp4'],
    mimeTypes: ['video/mp4'],
    magicNumbers: [{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }], // ftyp
    maxSize: 100 * 1024 * 1024, // 100MB
    description: 'MP4 Video',
  },
  webm: {
    extensions: ['webm'],
    mimeTypes: ['video/webm'],
    magicNumbers: [{ offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }], // EBML
    maxSize: 100 * 1024 * 1024, // 100MB
    description: 'WebM Video',
  },
};

/**
 * Dangerous file extensions that should never be allowed
 */
const DANGEROUS_EXTENSIONS = [
  'exe',
  'dll',
  'bat',
  'cmd',
  'com',
  'pif',
  'scr',
  'vbs',
  'js',
  'jar',
  'app',
  'deb',
  'rpm',
  'sh',
  'bash',
  'ps1',
  'msi',
];

/**
 * Suspicious filename patterns
 */
const SUSPICIOUS_PATTERNS = [
  /\.(exe|dll|bat|cmd|com|scr|vbs)$/i,
  /\.(php|asp|aspx|jsp)$/i,
  /^\.htaccess$/i,
  /^\.\./, // Path traversal
  /[<>:"|?*]/, // Invalid filename characters
  /\x00/, // Null bytes
];

// ==================== File Security Service ====================

class FileSecurityService {
  /**
   * Validate file against security rules
   */
  async validateFile(file: File): Promise<FileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Extract file information
    const fileName = file.name;
    const fileSize = file.size;
    const mimeType = file.type;
    const extension = this.getFileExtension(fileName);

    // 1. Sanitize filename
    const sanitizedFilename = sanitizationService.sanitizeFilename(fileName);
    if (sanitizedFilename !== fileName) {
      warnings.push('Filename was sanitized for security');
    }

    // 2. Check for dangerous extensions
    if (DANGEROUS_EXTENSIONS.includes(extension.toLowerCase())) {
      errors.push(`File extension .${extension} is not allowed for security reasons`);
    }

    // 3. Check for suspicious filename patterns
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(fileName)) {
        errors.push('Filename contains suspicious patterns');
        break;
      }
    }

    // 4. Check if file type is whitelisted
    const typeConfig = this.findFileTypeConfig(extension, mimeType);
    if (!typeConfig) {
      errors.push(
        `File type .${extension} (${mimeType}) is not in the allowed whitelist`
      );
    }

    // 5. Validate file size
    if (typeConfig && fileSize > typeConfig.maxSize) {
      errors.push(
        `File size ${this.formatFileSize(fileSize)} exceeds maximum allowed ${this.formatFileSize(typeConfig.maxSize)} for ${typeConfig.description}`
      );
    }

    // 6. Validate MIME type matches extension
    if (typeConfig && !typeConfig.mimeTypes.includes(mimeType)) {
      warnings.push(
        `MIME type ${mimeType} does not match expected types for .${extension} file`
      );
    }

    // 7. Validate magic number (file signature)
    if (typeConfig && typeConfig.magicNumbers.length > 0) {
      const magicNumberValid = await this.validateMagicNumber(file, typeConfig);
      if (!magicNumberValid) {
        errors.push(
          `File signature does not match .${extension} file type. File may be renamed or corrupted.`
        );
      }
    }

    // 8. Special validation for SVG files (security risk)
    if (extension === 'svg') {
      const svgValidation = await this.validateSvg(file);
      if (!svgValidation.valid) {
        errors.push(...svgValidation.errors);
      }
    }

    // 9. Check for zero-byte files
    if (fileSize === 0) {
      errors.push('File is empty (0 bytes)');
    }

    const category = this.getFileCategory(extension);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fileInfo: {
        name: sanitizedFilename,
        size: fileSize,
        type: mimeType,
        extension,
        category,
      },
    };
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  /**
   * Find file type configuration by extension and MIME type
   */
  private findFileTypeConfig(
    extension: string,
    mimeType: string
  ): FileTypeConfig | null {
    for (const [, config] of Object.entries(FILE_TYPE_CONFIGS)) {
      if (
        config.extensions.includes(extension.toLowerCase()) ||
        config.mimeTypes.includes(mimeType)
      ) {
        return config;
      }
    }
    return null;
  }

  /**
   * Validate file magic number (file signature)
   */
  private async validateMagicNumber(
    file: File,
    config: FileTypeConfig
  ): Promise<boolean> {
    try {
      // Read first 32 bytes of file
      const blob = file.slice(0, 32);
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // Check against all possible magic numbers for this type
      for (const magicNumber of config.magicNumbers) {
        const offset = magicNumber.offset;
        const expectedBytes = magicNumber.bytes;

        // Check if the bytes match
        let matches = true;
        for (let i = 0; i < expectedBytes.length; i++) {
          if (bytes[offset + i] !== expectedBytes[i]) {
            matches = false;
            break;
          }
        }

        if (matches) {
          return true;
        }
      }

      // No magic number matched
      return false;
    } catch (error) {
      console.error('Magic number validation error:', error);
      return false;
    }
  }

  /**
   * Validate SVG file for security risks
   */
  private async validateSvg(file: File): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const text = await file.text();

      // Check for script tags
      if (/<script/i.test(text)) {
        errors.push('SVG contains <script> tags which are not allowed');
      }

      // Check for event handlers
      if (/on\w+\s*=/i.test(text)) {
        errors.push('SVG contains event handlers which are not allowed');
      }

      // Check for external references
      if (/href\s*=\s*["']?(?:javascript|data):/i.test(text)) {
        errors.push('SVG contains dangerous external references');
      }

      // Check for embedded content
      if (/<foreignObject/i.test(text)) {
        errors.push('SVG contains foreignObject which could embed unsafe content');
      }
    } catch (error) {
      errors.push('Failed to parse SVG file');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get file category
   */
  private getFileCategory(extension: string): FileCategory {
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    const documentExts = ['pdf', 'doc', 'docx', 'txt', 'md'];
    const archiveExts = ['zip'];
    const audioExts = ['mp3', 'wav', 'm4a'];
    const videoExts = ['mp4', 'webm'];

    const ext = extension.toLowerCase();

    if (imageExts.includes(ext)) return 'image';
    if (documentExts.includes(ext)) return 'document';
    if (archiveExts.includes(ext)) return 'archive';
    if (audioExts.includes(ext)) return 'audio';
    if (videoExts.includes(ext)) return 'video';

    return 'unknown';
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get allowed file types for display
   */
  getAllowedFileTypes(): string[] {
    return Object.values(FILE_TYPE_CONFIGS).map((config) => config.description);
  }

  /**
   * Get allowed extensions
   */
  getAllowedExtensions(): string[] {
    const extensions = new Set<string>();
    Object.values(FILE_TYPE_CONFIGS).forEach((config) => {
      config.extensions.forEach((ext) => extensions.add(ext));
    });
    return Array.from(extensions);
  }

  /**
   * Get max file size for a specific type
   */
  getMaxFileSize(extension: string): number {
    const config = this.findFileTypeConfig(extension, '');
    return config ? config.maxSize : 0;
  }

  /**
   * Placeholder for virus scanning
   * In production, integrate with VirusTotal API, ClamAV, or similar
   */
  async scanForVirus(file: File): Promise<{ clean: boolean; threats: string[] }> {
    // TODO: Integrate with virus scanning service
    console.log('[Virus Scan] File:', file.name, 'Size:', file.size);

    // For now, just return clean
    // In production, you would:
    // 1. Upload file to virus scanning API
    // 2. Wait for scan results
    // 3. Return results

    return {
      clean: true,
      threats: [],
    };
  }

  /**
   * Comprehensive file validation (all checks)
   */
  async validateFileComprehensive(
    file: File,
    includeVirusScan: boolean = false
  ): Promise<FileValidationResult> {
    const validationResult = await this.validateFile(file);

    if (includeVirusScan && validationResult.valid) {
      const virusScan = await this.scanForVirus(file);
      if (!virusScan.clean) {
        validationResult.valid = false;
        validationResult.errors.push(
          `File contains threats: ${virusScan.threats.join(', ')}`
        );
      }
    }

    return validationResult;
  }
}

// ==================== Export ====================

export const fileSecurityService = new FileSecurityService();

// Export configurations for documentation
export { FILE_TYPE_CONFIGS, DANGEROUS_EXTENSIONS };
