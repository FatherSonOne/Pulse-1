// Document Processor Interface and Registry
// Unified interface for processing different file types

export interface ProcessorResult {
  text: string;
  metadata?: {
    pageCount?: number;
    wordCount?: number;
    author?: string;
    createdDate?: Date;
    confidence?: number; // For OCR
    sheets?: string[]; // For Excel
  };
  error?: string;
}

export interface DocumentProcessor {
  canProcess: (mimeType: string, extension: string) => boolean;
  process: (file: File, onProgress?: (progress: number) => void) => Promise<ProcessorResult>;
}

// Supported file types mapping
export const SUPPORTED_TYPES: Record<string, {
  extensions: string[];
  mimeTypes: string[];
  processorKey: string;
  label: string;
  icon: string;
}> = {
  text: {
    extensions: ['.txt'],
    mimeTypes: ['text/plain'],
    processorKey: 'text',
    label: 'Text',
    icon: 'fa-file-alt'
  },
  markdown: {
    extensions: ['.md', '.markdown'],
    mimeTypes: ['text/markdown', 'text/x-markdown'],
    processorKey: 'text',
    label: 'Markdown',
    icon: 'fa-file-code'
  },
  json: {
    extensions: ['.json'],
    mimeTypes: ['application/json'],
    processorKey: 'text',
    label: 'JSON',
    icon: 'fa-file-code'
  },
  pdf: {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    processorKey: 'pdf',
    label: 'PDF',
    icon: 'fa-file-pdf'
  },
  docx: {
    extensions: ['.docx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    processorKey: 'docx',
    label: 'Word',
    icon: 'fa-file-word'
  },
  xlsx: {
    extensions: ['.xlsx', '.xls'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ],
    processorKey: 'xlsx',
    label: 'Excel',
    icon: 'fa-file-excel'
  },
  image: {
    extensions: ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'],
    mimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/bmp', 'image/webp'],
    processorKey: 'image',
    label: 'Image',
    icon: 'fa-file-image'
  }
};

// Get file extension from filename
function getExtension(filename: string): string {
  const match = filename.match(/\.[^.]+$/);
  return match ? match[0].toLowerCase() : '';
}

// Determine file type from file
export function getFileType(file: File): string {
  const extension = getExtension(file.name);
  const mimeType = file.type.toLowerCase();

  for (const [key, config] of Object.entries(SUPPORTED_TYPES)) {
    if (config.extensions.includes(extension) || config.mimeTypes.includes(mimeType)) {
      return key;
    }
  }

  return 'text'; // Default to text
}

// Check if file is supported
export function isFileSupported(file: File): boolean {
  const extension = getExtension(file.name);
  const mimeType = file.type.toLowerCase();

  return Object.values(SUPPORTED_TYPES).some(
    config =>
      config.extensions.includes(extension) ||
      config.mimeTypes.includes(mimeType)
  );
}

// Get accept string for file input
export function getAcceptString(): string {
  const extensions: string[] = [];
  const mimeTypes: string[] = [];

  Object.values(SUPPORTED_TYPES).forEach(config => {
    extensions.push(...config.extensions);
    mimeTypes.push(...config.mimeTypes);
  });

  return [...new Set([...extensions, ...mimeTypes])].join(',');
}

// Lazy load processors to reduce initial bundle size
async function getProcessor(processorKey: string): Promise<DocumentProcessor | null> {
  try {
    switch (processorKey) {
      case 'text':
        const { textProcessor } = await import('./textProcessor');
        return textProcessor;
      case 'pdf':
        const { pdfProcessor } = await import('./pdfProcessor');
        return pdfProcessor;
      case 'docx':
        const { docxProcessor } = await import('./docxProcessor');
        return docxProcessor;
      case 'xlsx':
        const { xlsxProcessor } = await import('./xlsxProcessor');
        return xlsxProcessor;
      case 'image':
        const { imageProcessor } = await import('./imageProcessor');
        return imageProcessor;
      default:
        return null;
    }
  } catch (error) {
    console.error(`[DocumentProcessor] Failed to load processor: ${processorKey}`, error);
    return null;
  }
}

// Main processing function
export async function processDocument(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ProcessorResult> {
  console.log('[DocumentProcessor] Processing file:', file.name, file.type);

  const fileType = getFileType(file);
  const config = SUPPORTED_TYPES[fileType];

  if (!config) {
    return {
      text: '',
      error: `Unsupported file type: ${file.type || getExtension(file.name)}`
    };
  }

  onProgress?.(0.05);

  const processor = await getProcessor(config.processorKey);

  if (!processor) {
    return {
      text: '',
      error: `Processor not available for ${config.label} files`
    };
  }

  onProgress?.(0.1);

  try {
    const result = await processor.process(file, (p) => {
      // Map processor progress (0-1) to our range (0.1-0.95)
      onProgress?.(0.1 + p * 0.85);
    });

    onProgress?.(1);

    console.log('[DocumentProcessor] Processing complete:', {
      filename: file.name,
      textLength: result.text.length,
      hasError: !!result.error
    });

    return result;
  } catch (error) {
    console.error('[DocumentProcessor] Processing failed:', error);
    return {
      text: '',
      error: error instanceof Error ? error.message : 'Processing failed'
    };
  }
}

// Export everything
export { processDocument as default };
