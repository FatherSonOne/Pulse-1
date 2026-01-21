import { DocumentProcessor, ProcessorResult } from './index';
import ExcelJS from 'exceljs';

// Security constants
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_SHEETS = 100;
const MAX_CELLS_PER_SHEET = 100000;

// Sanitize cell value to prevent prototype pollution and XSS
function sanitizeValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Convert to string and remove any potentially dangerous content
  const str = String(value);

  // Remove prototype pollution attempts
  if (str.includes('__proto__') || str.includes('constructor') || str.includes('prototype')) {
    return '[FILTERED]';
  }

  // Basic XSS prevention - escape HTML entities
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .substring(0, 10000); // Limit individual cell size
}

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

      // Security: Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return {
          text: '',
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
        };
      }

      onProgress?.(0.1);

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      onProgress?.(0.2);

      // Parse workbook with ExcelJS
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      onProgress?.(0.4);

      const worksheets = workbook.worksheets;

      // Security: Limit number of sheets
      if (worksheets.length > MAX_SHEETS) {
        return {
          text: '',
          error: `Too many sheets. Maximum is ${MAX_SHEETS}`
        };
      }

      console.log('[XLSXProcessor] Found sheets:', worksheets.map(ws => ws.name));

      const textParts: string[] = [];
      const totalSheets = worksheets.length;

      // Process each sheet
      for (let i = 0; i < totalSheets; i++) {
        const worksheet = worksheets[i];
        const sheetName = worksheet.name;
        const rows: string[] = [];

        let cellCount = 0;

        // Iterate through rows
        worksheet.eachRow((row, rowNumber) => {
          const cellValues: string[] = [];

          row.eachCell((cell, colNumber) => {
            cellCount++;

            // Security: Limit cells per sheet to prevent DoS
            if (cellCount > MAX_CELLS_PER_SHEET) {
              return;
            }

            // Extract and sanitize cell value
            const value = cell.value;
            let sanitizedValue = '';

            if (value !== null && value !== undefined) {
              // Handle different cell types
              if (typeof value === 'object' && 'text' in value) {
                // Rich text
                sanitizedValue = sanitizeValue(value.text);
              } else if (typeof value === 'object' && 'result' in value) {
                // Formula
                sanitizedValue = sanitizeValue(value.result);
              } else if (value instanceof Date) {
                sanitizedValue = value.toISOString();
              } else {
                sanitizedValue = sanitizeValue(value);
              }
            }

            cellValues.push(sanitizedValue);
          });

          if (cellValues.some(v => v.trim())) {
            rows.push(cellValues.join(','));
          }
        });

        if (cellCount > MAX_CELLS_PER_SHEET) {
          console.warn(`[XLSXProcessor] Sheet "${sheetName}" exceeded cell limit, truncated`);
        }

        if (rows.length > 0) {
          textParts.push(`## Sheet: ${sanitizeValue(sheetName)}\n\n${rows.join('\n')}`);
        }

        // Update progress
        const sheetProgress = 0.4 + ((i + 1) / totalSheets) * 0.5;
        onProgress?.(sheetProgress);
      }

      onProgress?.(0.95);

      const fullText = textParts.join('\n\n---\n\n');
      const wordCount = fullText.split(/\s+/).filter(Boolean).length;

      console.log('[XLSXProcessor] Extraction complete:', {
        sheets: worksheets.length,
        characters: fullText.length,
        words: wordCount
      });

      onProgress?.(1);

      return {
        text: fullText,
        metadata: {
          pageCount: worksheets.length,
          wordCount,
          sheets: worksheets.map(ws => sanitizeValue(ws.name))
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
