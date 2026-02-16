/**
 * File Polyfill Utility for Testing
 *
 * Provides Web API polyfills for File/Blob objects in Node.js test environment.
 * Use this helper when testing file upload or processing functionality.
 *
 * @module test/utils/filePolyfill
 */

/**
 * Creates a File object with polyfilled Web API methods for Node.js compatibility
 *
 * @param content - File content as string or Uint8Array
 * @param filename - Name of the file
 * @param mimeType - MIME type of the file (default: 'text/plain')
 * @returns File object with polyfilled arrayBuffer(), text(), and slice() methods
 *
 * @example
 * ```typescript
 * // Create a text file
 * const textFile = createMockFile('Hello, World!', 'test.txt', 'text/plain');
 *
 * // Create a binary file
 * const binaryData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
 * const imageFile = createMockFile(binaryData, 'image.jpg', 'image/jpeg');
 *
 * // Use in tests
 * const buffer = await textFile.arrayBuffer();
 * const text = await textFile.text();
 * const slice = textFile.slice(0, 5);
 * ```
 */
export function createMockFile(
  content: string | Uint8Array,
  filename: string,
  mimeType: string = 'text/plain'
): File {
  const bytes = typeof content === 'string'
    ? new TextEncoder().encode(content)
    : content;

  const file = new File([bytes], filename, { type: mimeType });

  // Polyfill arrayBuffer()
  if (!file.arrayBuffer) {
    Object.defineProperty(file, 'arrayBuffer', {
      value: async function() {
        return bytes.buffer;
      }
    });
  }

  // Polyfill text()
  if (!file.text) {
    Object.defineProperty(file, 'text', {
      value: async function() {
        return new TextDecoder().decode(bytes);
      }
    });
  }

  // Ensure slice() returns Blob with arrayBuffer()
  const originalSlice = file.slice.bind(file);
  Object.defineProperty(file, 'slice', {
    value: function(start?: number, end?: number, contentType?: string) {
      const slicedBlob = originalSlice(start, end, contentType);

      if (!slicedBlob.arrayBuffer) {
        Object.defineProperty(slicedBlob, 'arrayBuffer', {
          value: async function() {
            const sliceStart = start || 0;
            const sliceEnd = end || bytes.length;
            return bytes.slice(sliceStart, sliceEnd).buffer;
          }
        });
      }

      return slicedBlob;
    }
  });

  return file;
}
