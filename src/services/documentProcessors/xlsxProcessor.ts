import { DocumentProcessor, ProcessorResult } from './index';
import * as XLSX from 'xlsx';

export const xlsxProcessor: DocumentProcessor = {
  canProcess: (mimeType: string, extension: string): boolean => {
    const xlsMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    const xlsExts = ['.xlsx', '.xls'];
    return xlsMimes.includes(mimeType.toLowerCase()) || xlsExts.includes(extension.toLowerCase());
  },

  async process(file: File, onProgress?: (progress: number) => void): Promise<ProcessorResult> {
    try {
      console.log('[XLSXProcessor] Starting Excel processing:', file.name);
      onProgress?.(0.1);

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      onProgress?.(0.2);

      // Parse workbook
      const workbook = XLSX.read(arrayBuffer, {
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellText: true
      });

      onProgress?.(0.4);

      const sheetNames = workbook.SheetNames;
      console.log('[XLSXProcessor] Found sheets:', sheetNames);

      const textParts: string[] = [];
      const totalSheets = sheetNames.length;

      // Process each sheet
      for (let i = 0; i < totalSheets; i++) {
        const sheetName = sheetNames[i];
        const sheet = workbook.Sheets[sheetName];

        // Convert to readable format
        // Use CSV for best text extraction
        const csvContent = XLSX.utils.sheet_to_csv(sheet, {
          blankrows: false,
          strip: true
        });

        if (csvContent.trim()) {
          textParts.push(`## Sheet: ${sheetName}\n\n${csvContent}`);
        }

        // Update progress
        const sheetProgress = 0.4 + ((i + 1) / totalSheets) * 0.5;
        onProgress?.(sheetProgress);
      }

      onProgress?.(0.95);

      const fullText = textParts.join('\n\n---\n\n');
      const wordCount = fullText.split(/\s+/).filter(Boolean).length;

      console.log('[XLSXProcessor] Extraction complete:', {
        sheets: sheetNames.length,
        characters: fullText.length,
        words: wordCount
      });

      onProgress?.(1);

      return {
        text: fullText,
        metadata: {
          pageCount: sheetNames.length,
          wordCount,
          sheets: sheetNames
        }
      };
    } catch (error) {
      console.error('[XLSXProcessor] Error:', error);
      return {
        text: '',
        error: error instanceof Error ? error.message : 'Failed to process Excel file'
      };
    }
  }
};

export default xlsxProcessor;
