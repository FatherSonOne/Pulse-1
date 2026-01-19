import { DocumentProcessor, ProcessorResult } from './index';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
// Use the CDN version to avoid bundling issues
// Note: pdfjs-dist v4+ uses .mjs extensions on CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// Fallback: If CDN fails, disable worker (runs on main thread)
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    if (e.message?.includes('pdf.worker')) {
      console.warn('[PDFProcessor] Worker failed to load, disabling worker');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }
  });
}

export const pdfProcessor: DocumentProcessor = {
  canProcess: (mimeType: string, extension: string): boolean => {
    return mimeType === 'application/pdf' || extension.toLowerCase() === '.pdf';
  },

  async process(file: File, onProgress?: (progress: number) => void): Promise<ProcessorResult> {
    try {
      console.log('[PDFProcessor] Starting PDF processing:', file.name);
      onProgress?.(0.1);

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      onProgress?.(0.2);

      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });

      loadingTask.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
        if (total > 0) {
          onProgress?.(0.2 + (loaded / total) * 0.2);
        }
      };

      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      console.log('[PDFProcessor] PDF loaded, pages:', numPages);

      onProgress?.(0.4);

      // Extract text from all pages
      const textParts: string[] = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();

          // Reconstruct text with proper spacing
          let lastY: number | null = null;
          let pageText = '';

          for (const item of textContent.items) {
            if ('str' in item) {
              const textItem = item as { str: string; transform: number[] };
              const y = textItem.transform[5];

              // Add newline if Y position changed significantly (new line)
              if (lastY !== null && Math.abs(lastY - y) > 5) {
                pageText += '\n';
              } else if (pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
                pageText += ' ';
              }

              pageText += textItem.str;
              lastY = y;
            }
          }

          if (pageText.trim()) {
            textParts.push(`--- Page ${pageNum} ---\n${pageText.trim()}`);
          }

          // Update progress for each page
          const pageProgress = 0.4 + (pageNum / numPages) * 0.5;
          onProgress?.(pageProgress);
        } catch (pageError) {
          console.warn(`[PDFProcessor] Error processing page ${pageNum}:`, pageError);
          textParts.push(`--- Page ${pageNum} ---\n[Error extracting text from this page]`);
        }
      }

      onProgress?.(0.95);

      const fullText = textParts.join('\n\n');
      const wordCount = fullText.split(/\s+/).filter(Boolean).length;

      console.log('[PDFProcessor] Extraction complete:', {
        pages: numPages,
        characters: fullText.length,
        words: wordCount
      });

      onProgress?.(1);

      return {
        text: fullText,
        metadata: {
          pageCount: numPages,
          wordCount
        }
      };
    } catch (error) {
      console.error('[PDFProcessor] Error:', error);
      return {
        text: '',
        error: error instanceof Error ? error.message : 'Failed to process PDF file'
      };
    }
  }
};

export default pdfProcessor;
