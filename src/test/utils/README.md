# Test Utilities

Shared testing utilities for the Pulse1 project. These utilities provide common functionality needed across multiple test files.

## Available Utilities

### File Polyfill (`filePolyfill.ts`)

Provides Web API polyfills for File/Blob objects in Node.js test environments.

**Purpose**: Node.js test environments lack several Web APIs that browsers provide natively. This utility polyfills missing methods to enable testing of file upload and processing functionality.

**What it polyfills**:
- `File.arrayBuffer()` - Returns ArrayBuffer from file content
- `File.text()` - Decodes file content to string
- `Blob.slice()` - Enhanced to ensure sliced Blobs also have `arrayBuffer()` method

**Usage**:
```typescript
import { createMockFile } from '@/test/utils/filePolyfill';

// Create a text file
const textFile = createMockFile('Hello, World!', 'test.txt', 'text/plain');

// Create a binary file (e.g., image)
const jpegData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
const imageFile = createMockFile(jpegData, 'photo.jpg', 'image/jpeg');

// Use in tests
const buffer = await imageFile.arrayBuffer();
const text = await textFile.text();
const slice = imageFile.slice(0, 100);
```

**Real-world example** (from fileSecurityService tests):
```typescript
import { createMockFile } from '@/test/utils/filePolyfill';
import { fileSecurityService } from '@/services/fileSecurityService';

describe('File Security Tests', () => {
  it('should validate JPEG magic numbers', async () => {
    const jpegMagic = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
    const file = createMockFile(jpegMagic, 'photo.jpg', 'image/jpeg');

    const result = await fileSecurityService.validateFile(file);

    expect(result.valid).toBe(true);
    expect(result.fileInfo.category).toBe('image');
  });

  it('should reject executable files', async () => {
    const exeMagic = new Uint8Array([0x4D, 0x5A]); // MZ header
    const file = createMockFile(exeMagic, 'malware.exe', 'application/x-msdownload');

    const result = await fileSecurityService.validateFile(file);

    expect(result.valid).toBe(false);
  });
});
```

**API Reference**:
```typescript
function createMockFile(
  content: string | Uint8Array,
  filename: string,
  mimeType?: string = 'text/plain'
): File
```

**Parameters**:
- `content` - File content as string or Uint8Array
- `filename` - Name of the file including extension
- `mimeType` - (Optional) MIME type of the file (default: 'text/plain')

**Returns**: File object with polyfilled Web API methods

## Migration Guide

If you have local `createMockFile` helper functions in your test files, you can replace them with this shared utility:

### Before (local helper)
```typescript
// In your test file
function createMockFile(name: string, type: string, content: Uint8Array): File {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });

  if (!file.arrayBuffer) {
    Object.defineProperty(file, 'arrayBuffer', {
      value: async function() { return content.buffer; }
    });
  }

  return file;
}
```

### After (shared utility)
```typescript
import { createMockFile } from '@/test/utils/filePolyfill';

// Use directly - note parameter order: content, name, type
const file = createMockFile(content, name, type);
```

## Adding New Utilities

When adding new test utilities to this directory:

1. Create a new TypeScript file with a descriptive name
2. Export functions with clear JSDoc documentation
3. Add usage examples in this README
4. Ensure TypeScript compiles without errors: `npx tsc --noEmit src/test/utils/yourUtility.ts`
5. Consider creating a `.example.md` file with detailed usage examples

## Directory Structure

```
src/test/utils/
├── README.md                    # This file
├── filePolyfill.ts              # File/Blob Web API polyfills
└── filePolyfill.example.md      # Detailed usage examples for file polyfill
```

## Related Documentation

- [TEST_COMPLETION_PLAN.md](../../../TEST_COMPLETION_PLAN.md) - Phase 4 cleanup tasks
- [File Security Service Tests](../../services/__tests__/fileSecurityService.test.ts) - Example usage
