/**
 * File Upload Service
 * Handles secure file uploads to Supabase Storage with validation and processing
 *
 * SECURITY FEATURES (Phase 6.4):
 * - File type validation with magic number checking
 * - File size limits enforcement
 * - Malicious file pattern detection
 * - Rate limiting for uploads
 * - Sanitized file metadata
 */

import { supabase } from './supabase';
import { fileSecurityService } from './fileSecurityService';
import { rateLimitService } from './rateLimitService';
import { sanitizationService } from './sanitizationService';

// ==================== Types ====================

export interface UploadOptions {
  bucket?: string;
  folder?: string;
  maxSize?: number;
  allowedTypes?: string[];
  generateThumbnail?: boolean;
}

export interface UploadResult {
  id: string;
  url: string;
  publicUrl: string;
  thumbnailUrl?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// ==================== Constants ====================

const DEFAULT_BUCKET = 'message-attachments';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const THUMBNAIL_SIZE = 200; // 200x200 pixels

const ALLOWED_FILE_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  documents: ['application/pdf', 'text/plain', 'text/csv', 'application/json'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
};

// ==================== Helper Functions ====================

/**
 * Generate unique file name with timestamp
 */
function generateFileName(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop();
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');

  return `${nameWithoutExt}_${timestamp}_${random}.${extension}`;
}

/**
 * Get file category from MIME type
 */
function getFileCategory(mimeType: string): 'image' | 'document' | 'audio' | 'video' | 'other' {
  if (ALLOWED_FILE_TYPES.images.includes(mimeType)) return 'image';
  if (ALLOWED_FILE_TYPES.documents.includes(mimeType)) return 'document';
  if (ALLOWED_FILE_TYPES.audio.includes(mimeType)) return 'audio';
  if (ALLOWED_FILE_TYPES.video.includes(mimeType)) return 'video';
  return 'other';
}

/**
 * Create thumbnail for image files
 */
async function createThumbnail(file: File, size: number = THUMBNAIL_SIZE): Promise<Blob | null> {
  if (!file.type.startsWith('image/')) return null;

  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      // Calculate dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > size) {
          height = (height * size) / width;
          width = size;
        }
      } else {
        if (height > size) {
          width = (width * size) / height;
          height = size;
        }
      }

      canvas.width = width;
      canvas.height = height;

      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        'image/jpeg',
        0.8
      );
    };

    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}

// ==================== Upload Service ====================

export class FileUploadService {
  /**
   * Upload a single file to Supabase Storage
   */
  async uploadFile(
    file: File,
    userId: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    // 1. Check rate limits for file uploads
    const rateLimitCheck = await rateLimitService.checkLimit('file_upload', userId);
    if (!rateLimitCheck.allowed) {
      throw new Error(
        `Upload rate limit exceeded. Please wait ${Math.ceil(rateLimitCheck.retryAfter / 60000)} minutes before uploading more files.`
      );
    }

    // 2. Comprehensive file security validation
    const validation = await fileSecurityService.validateFileComprehensive(file, false);
    if (!validation.valid) {
      console.error('File validation failed:', validation.errors);
      throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.warn('File validation warnings:', validation.warnings);
    }

    // 3. Check file size
    const maxSize = options.maxSize || MAX_FILE_SIZE;
    if (file.size > maxSize) {
      throw new Error(`File size exceeds maximum of ${maxSize / 1024 / 1024}MB`);
    }

    // 4. Check file type if allowedTypes specified
    if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} is not allowed`);
    }

    const bucket = options.bucket || DEFAULT_BUCKET;
    const folder = options.folder || userId;

    // 5. Sanitize filename
    const sanitizedOriginalName = sanitizationService.sanitizeFilename(file.name);
    const fileName = generateFileName(sanitizedOriginalName);
    const filePath = `${folder}/${fileName}`;

    // Upload main file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

    // Upload thumbnail if requested and file is an image
    let thumbnailUrl: string | undefined;
    if (options.generateThumbnail && file.type.startsWith('image/')) {
      try {
        const thumbnail = await createThumbnail(file);
        if (thumbnail) {
          const thumbnailPath = `${folder}/thumbnails/${fileName}`;
          const { error: thumbError } = await supabase.storage
            .from(bucket)
            .upload(thumbnailPath, thumbnail);

          if (!thumbError) {
            const { data: thumbUrlData } = supabase.storage
              .from(bucket)
              .getPublicUrl(thumbnailPath);
            thumbnailUrl = thumbUrlData.publicUrl;
          }
        }
      } catch (error) {
        console.warn('Failed to generate thumbnail:', error);
        // Continue without thumbnail
      }
    }

    // Store file metadata in database with sanitization
    const fileMetadata = {
      user_id: sanitizationService.sanitizeText(userId),
      file_name: sanitizedOriginalName,
      file_path: filePath,
      file_size: file.size,
      file_type: sanitizationService.sanitizeText(file.type),
      file_category: getFileCategory(file.type),
      public_url: urlData.publicUrl,
      thumbnail_url: thumbnailUrl,
      uploaded_at: new Date().toISOString(),
    };

    const { data: metaData, error: metaError } = await supabase
      .from('file_uploads')
      .insert(fileMetadata)
      .select()
      .single();

    if (metaError) {
      console.error('Metadata storage error:', metaError);
      // Don't throw - file is uploaded, metadata can be added later
    }

    // Record rate limit usage after successful upload
    await rateLimitService.recordRequest('file_upload', userId);

    return {
      id: metaData?.id || uploadData.path,
      url: filePath,
      publicUrl: urlData.publicUrl,
      thumbnailUrl,
      fileName: sanitizedOriginalName,
      fileSize: file.size,
      fileType: file.type,
      uploadedAt: new Date().toISOString(),
    };
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(
    files: File[],
    userId: string,
    options: UploadOptions = {},
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    let loaded = 0;
    const total = files.reduce((sum, file) => sum + file.size, 0);

    for (const file of files) {
      try {
        const result = await this.uploadFile(file, userId, options);
        results.push(result);

        loaded += file.size;
        if (onProgress) {
          onProgress({
            loaded,
            total,
            percentage: Math.round((loaded / total) * 100),
          });
        }
      } catch (error: any) {
        console.error(`Failed to upload ${file.name}:`, error);
        // Continue with other files
      }
    }

    return results;
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(filePath: string, bucket: string = DEFAULT_BUCKET): Promise<void> {
    const { error } = await supabase.storage.from(bucket).remove([filePath]);

    if (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }

    // Also delete thumbnail if exists
    const thumbnailPath = filePath.replace(/([^/]+)$/, 'thumbnails/$1');
    await supabase.storage.from(bucket).remove([thumbnailPath]);

    // Delete metadata
    await supabase.from('file_uploads').delete().eq('file_path', filePath);
  }

  /**
   * Get file metadata by ID
   */
  async getFileMetadata(fileId: string): Promise<any> {
    const { data, error } = await supabase
      .from('file_uploads')
      .select('*')
      .eq('id', fileId)
      .single();

    if (error) {
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }

    return data;
  }

  /**
   * List files for a user
   */
  async listFiles(
    userId: string,
    options: { limit?: number; category?: string } = {}
  ): Promise<any[]> {
    let query = supabase
      .from('file_uploads')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.category) {
      query = query.eq('file_category', options.category);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get signed URL for private file access
   */
  async getSignedUrl(
    filePath: string,
    bucket: string = DEFAULT_BUCKET,
    expiresIn: number = 3600
  ): Promise<string> {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }
}

// Export singleton instance
export const fileUploadService = new FileUploadService();

// ==================== React Hook ====================

/**
 * React hook for file uploads with progress tracking
 */
export function useFileUpload() {
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState<UploadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0,
  });
  const [error, setError] = React.useState<string | null>(null);

  const upload = async (
    files: File | File[],
    userId: string,
    options?: UploadOptions
  ): Promise<UploadResult[]> => {
    setUploading(true);
    setError(null);
    setProgress({ loaded: 0, total: 0, percentage: 0 });

    try {
      const fileArray = Array.isArray(files) ? files : [files];
      const results = await fileUploadService.uploadFiles(
        fileArray,
        userId,
        options,
        setProgress
      );

      return results;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setUploading(false);
    }
  };

  return {
    upload,
    uploading,
    progress,
    error,
  };
}

// Note: React is imported dynamically to avoid issues in non-React contexts
import React from 'react';
