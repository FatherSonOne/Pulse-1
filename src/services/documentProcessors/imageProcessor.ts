import { DocumentProcessor, ProcessorResult } from './index';
import Tesseract from 'tesseract.js';

// Maximum file size for OCR (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const imageProcessor: DocumentProcessor = {
  canProcess: (mimeType: string, extension: string): boolean => {
    const imageMimes = ['image/png', 'image/jpeg', 'image/gif', 'image/bmp', 'image/webp'];
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
    return imageMimes.includes(mimeType.toLowerCase()) || imageExts.includes(extension.toLowerCase());
  },

  async process(file: File, onProgress?: (progress: number) => void): Promise<ProcessorResult> {
    try {
      console.log('[ImageProcessor] Starting OCR processing:', file.name, `(${(file.size / 1024).toFixed(1)}KB)`);

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        return {
          text: '',
          error: `Image too large for OCR. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
        };
      }

      onProgress?.(0.05);

      // Create image URL from file
      const imageUrl = URL.createObjectURL(file);

      try {
        // Run OCR with Tesseract.js
        const result = await Tesseract.recognize(imageUrl, 'eng', {
          logger: (m) => {
            if (m.status === 'recognizing text' && typeof m.progress === 'number') {
              // Map tesseract progress (0-1) to our range (0.1-0.9)
              onProgress?.(0.1 + m.progress * 0.8);
            } else if (m.status === 'loading tesseract core') {
              onProgress?.(0.05);
            } else if (m.status === 'initializing tesseract') {
              onProgress?.(0.08);
            } else if (m.status === 'loading language traineddata') {
              onProgress?.(0.1);
            }
          }
        });

        onProgress?.(0.95);

        const text = result.data.text.trim();
        const confidence = result.data.confidence;
        const wordCount = text.split(/\s+/).filter(Boolean).length;

        console.log('[ImageProcessor] OCR complete:', {
          characters: text.length,
          words: wordCount,
          confidence: confidence.toFixed(1) + '%'
        });

        onProgress?.(1);

        // Add confidence warning if low
        let processedText = text;
        if (confidence < 70) {
          processedText = `[Note: OCR confidence is ${confidence.toFixed(0)}% - text may contain errors]\n\n${text}`;
        }

        return {
          text: processedText,
          metadata: {
            wordCount,
            confidence
          }
        };
      } finally {
        // Clean up object URL
        URL.revokeObjectURL(imageUrl);
      }
    } catch (error) {
      console.error('[ImageProcessor] Error:', error);
      return {
        text: '',
        error: error instanceof Error ? error.message : 'Failed to perform OCR on image'
      };
    }
  }
};

export default imageProcessor;
