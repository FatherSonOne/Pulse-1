import { DocumentProcessor, ProcessorResult } from './index';

export const textProcessor: DocumentProcessor = {
  canProcess: (mimeType: string, extension: string): boolean => {
    const textMimes = ['text/plain', 'text/markdown', 'text/x-markdown', 'application/json'];
    const textExts = ['.txt', '.md', '.markdown', '.json'];
    return textMimes.includes(mimeType.toLowerCase()) || textExts.includes(extension.toLowerCase());
  },

  async process(file: File, onProgress?: (progress: number) => void): Promise<ProcessorResult> {
    try {
      onProgress?.(0.1);

      const text = await file.text();

      onProgress?.(0.9);

      // Calculate word count
      const wordCount = text.split(/\s+/).filter(Boolean).length;

      onProgress?.(1);

      return {
        text,
        metadata: {
          wordCount
        }
      };
    } catch (error) {
      console.error('[TextProcessor] Error:', error);
      return {
        text: '',
        error: error instanceof Error ? error.message : 'Failed to read text file'
      };
    }
  }
};

export default textProcessor;
