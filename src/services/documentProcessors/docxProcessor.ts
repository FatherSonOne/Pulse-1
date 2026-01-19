import { DocumentProcessor, ProcessorResult } from './index';
import mammoth from 'mammoth';

export const docxProcessor: DocumentProcessor = {
  canProcess: (mimeType: string, extension: string): boolean => {
    return (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      extension.toLowerCase() === '.docx'
    );
  },

  async process(file: File, onProgress?: (progress: number) => void): Promise<ProcessorResult> {
    try {
      console.log('[DOCXProcessor] Starting DOCX processing:', file.name);
      onProgress?.(0.1);

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      onProgress?.(0.3);

      // Extract text using mammoth
      const result = await mammoth.extractRawText({ arrayBuffer });
      onProgress?.(0.8);

      const text = result.value;
      const wordCount = text.split(/\s+/).filter(Boolean).length;

      // Log any warnings from mammoth
      if (result.messages && result.messages.length > 0) {
        console.log('[DOCXProcessor] Mammoth messages:', result.messages);
      }

      console.log('[DOCXProcessor] Extraction complete:', {
        characters: text.length,
        words: wordCount
      });

      onProgress?.(1);

      return {
        text,
        metadata: {
          wordCount
        }
      };
    } catch (error) {
      console.error('[DOCXProcessor] Error:', error);
      return {
        text: '',
        error: error instanceof Error ? error.message : 'Failed to process DOCX file'
      };
    }
  }
};

export default docxProcessor;
