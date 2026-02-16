# Testing Guide

> Comprehensive guide to testing patterns, utilities, and best practices for the Pulse1 project

## Table of Contents

- [Overview](#overview)
- [Test Utilities](#test-utilities)
  - [File Testing Patterns](#file-testing-patterns)
  - [Supabase Mock Patterns](#supabase-mock-patterns)
  - [IndexedDB Testing](#indexeddb-testing)
- [Common Test Scenarios](#common-test-scenarios)
- [Vitest 4.0.18 Compatibility](#vitest-4018-compatibility)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

### Purpose

This guide documents testing patterns, utilities, and best practices developed during the test restoration project. It provides practical examples and reusable utilities to help developers write reliable, maintainable tests.

### Testing Philosophy

Our testing approach emphasizes:

- **Isolation**: Tests should be independent and not affect each other
- **Reliability**: Tests should produce consistent results across environments
- **Maintainability**: Test code should be clear, well-organized, and reusable
- **Performance**: Tests should run quickly to enable fast feedback cycles
- **Realism**: Mocks should accurately represent real service behavior

### Tools and Frameworks

- **Vitest 4.0.18**: Fast unit test framework with Jest-compatible API
- **jsdom**: Browser environment simulation for testing browser APIs
- **React Testing Library**: Component testing utilities (via @vitejs/plugin-react)

### Test Configuration

The project uses Vitest with the following configuration:

```typescript
// vitest.config.ts
{
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/test/setup.ts'],
  testTimeout: 10000,
  mockReset: true,
  restoreMocks: true,
  clearMocks: true,
}
```

Key settings:
- **jsdom environment**: Provides browser APIs like `File`, `Blob`, `localStorage`
- **Mock reset**: Automatically clears mocks between tests
- **10s timeout**: Allows time for async operations and IndexedDB setup

### Running Tests

```bash
# Run all tests
npm test

# Run tests once (no watch mode)
npm run test:run

# Run with coverage
npm run test:coverage

# Run specific test file
npm test rateLimitService.test.ts

# Run specific test case
npm test -- -t "should enforce rate limits"
```

---

## Test Utilities

### File Testing Patterns

**Location**: `src/test/utils/filePolyfill.ts`

**Purpose**: Polyfills Web API methods for File/Blob objects in Node.js test environments

#### Why This Utility Exists

Node.js test environments lack several Web APIs that browsers provide natively:

1. `File.arrayBuffer()` - Not available in Node.js
2. `File.text()` - Not available in Node.js
3. `Blob.slice()` - Returns blob without `arrayBuffer()` method

The `createMockFile` utility polyfills these missing methods, enabling tests for file upload and processing functionality.

#### Basic Usage

```typescript
import { createMockFile } from '@/test/utils/filePolyfill';

// Create a text file
const textFile = createMockFile(
  'Hello, World!',
  'test.txt',
  'text/plain'
);

// Create a binary file (e.g., JPEG image)
const jpegData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
const imageFile = createMockFile(
  jpegData,
  'photo.jpg',
  'image/jpeg'
);

// Use in tests
const buffer = await imageFile.arrayBuffer();
const text = await textFile.text();
const slice = imageFile.slice(0, 100);
```

#### API Reference

```typescript
function createMockFile(
  content: string | Uint8Array,
  filename: string,
  mimeType?: string = 'text/plain'
): File
```

**Parameters**:
- `content`: File content as string or Uint8Array
- `filename`: File name including extension
- `mimeType`: (Optional) MIME type (default: 'text/plain')

**Returns**: File object with polyfilled Web API methods

#### Real-World Examples

**Example 1: Testing Magic Number Validation**

```typescript
import { describe, it, expect } from 'vitest';
import { createMockFile } from '@/test/utils/filePolyfill';
import { fileSecurityService } from '@/services/fileSecurityService';

describe('File Security Tests', () => {
  it('should validate JPEG magic numbers', async () => {
    // JPEG magic number: 0xFF 0xD8 0xFF 0xE0
    const jpegMagic = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
    const file = createMockFile(jpegMagic, 'photo.jpg', 'image/jpeg');

    const result = await fileSecurityService.validateFile(file);

    expect(result.valid).toBe(true);
    expect(result.fileInfo.category).toBe('image');
  });

  it('should reject executable files', async () => {
    // Windows EXE magic number: MZ header
    const exeMagic = new Uint8Array([0x4D, 0x5A]);
    const file = createMockFile(exeMagic, 'malware.exe', 'application/x-msdownload');

    const result = await fileSecurityService.validateFile(file);

    expect(result.valid).toBe(false);
  });
});
```

**Example 2: Testing SVG Content Validation**

```typescript
it('should validate SVG content', async () => {
  const svgContent = '<svg><rect width="100" height="100" fill="blue"/></svg>';
  const svgFile = createMockFile(
    svgContent,
    'image.svg',
    'image/svg+xml'
  );

  // SVG validation reads content as text
  const text = await svgFile.text();
  expect(text).toContain('rect');
});
```

**Example 3: Testing File Slicing**

```typescript
it('should handle file slicing', async () => {
  const content = 'ABCDEFGHIJKLMNOP';
  const file = createMockFile(content, 'data.txt', 'text/plain');

  // Slice first 5 bytes
  const slice = file.slice(0, 5);
  const sliceBuffer = await slice.arrayBuffer();
  const sliceText = new TextDecoder().decode(sliceBuffer);

  expect(sliceText).toBe('ABCDE');
});
```

#### Common Magic Numbers Reference

```typescript
// Image formats
const JPEG = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46]);

// Document formats
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
const ZIP = new Uint8Array([0x50, 0x4B, 0x03, 0x04]);

// Audio formats
const MP3 = new Uint8Array([0xFF, 0xFB]); // MPEG-1 Layer 3
const OGG = new Uint8Array([0x4F, 0x67, 0x67, 0x53]); // OggS

// Video formats
const MP4 = new Uint8Array([0x66, 0x74, 0x79, 0x70]); // ftyp
```

#### When to Use

Use `createMockFile` when testing:
- File upload functionality
- File type validation
- Magic number verification
- File content processing
- File size limits
- Multi-file operations

**Reference**: See `src/test/utils/filePolyfill.example.md` for more detailed examples.

---

### Supabase Mock Patterns

**Location**: `src/test/utils/supabaseMock.ts`

**Purpose**: Provides reusable utilities for mocking Supabase client query chains

#### Why This Utility Exists

Supabase uses a chainable query builder pattern:

```typescript
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)
  .single();
```

Mocking these chains manually in every test is repetitive and error-prone. The `supabaseMock` utility provides a flexible, reusable solution that handles all common query patterns.

#### Core Functions

##### 1. `createSupabaseMock<T>(config)`

Creates a mock for a single table with chainable query methods.

```typescript
interface SupabaseMockConfig<T> {
  table: string;      // Table name
  data?: T[];         // Mock data to return
  error?: any;        // Mock error to return
  single?: boolean;   // Return single record instead of array
}
```

**Example: Basic Usage**

```typescript
import { createSupabaseMock } from '@/test/utils/supabaseMock';

const usersMock = createSupabaseMock({
  table: 'users',
  data: [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
  ],
});

// Mock returns data for any query chain
mockSupabase.from.mockReturnValue(usersMock.chainMock);

// Now this works:
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('id', '1');

// data = [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }]
```

**Example: Single Record**

```typescript
const userMock = createSupabaseMock({
  table: 'users',
  data: [{ id: '1', name: 'Alice' }],
  single: true, // Return first item, not array
});

// Returns: { data: { id: '1', name: 'Alice' }, error: null }
```

**Example: Error Handling**

```typescript
const errorMock = createSupabaseMock({
  table: 'users',
  error: new Error('Database connection failed'),
});

// Returns: { data: null, error: Error(...) }
```

##### 2. `mockSupabaseClient(tables)`

Creates a complete Supabase client mock with multiple tables.

```typescript
import { mockSupabaseClient, createSupabaseMock } from '@/test/utils/supabaseMock';

const mockClient = mockSupabaseClient({
  users: createSupabaseMock({
    table: 'users',
    data: [{ id: '1', name: 'Alice' }],
  }),
  posts: createSupabaseMock({
    table: 'posts',
    data: [{ id: 'p1', title: 'Hello' }],
  }),
});

// Use in your mock
mockSupabase.from = mockClient.from;

// Both queries work now
await supabase.from('users').select('*');
await supabase.from('posts').select('*');
```

##### 3. `createInsertMock<T>(data, error?)`

Helper for insert().select().single() pattern.

```typescript
const insertMock = createInsertMock({ id: 'new-1', name: 'Charlie' });

mockSupabase.from.mockReturnValue({
  insert: insertMock.insert,
});

// This pattern works:
const { data, error } = await supabase
  .from('users')
  .insert({ name: 'Charlie' })
  .select()
  .single();

// data = { id: 'new-1', name: 'Charlie' }
```

##### 4. `createUpdateMock(error?)`

Helper for update().eq() pattern.

```typescript
const updateMock = createUpdateMock();

mockSupabase.from.mockReturnValue({
  update: updateMock.update,
});

// This pattern works:
await supabase
  .from('users')
  .update({ name: 'Updated' })
  .eq('id', '1');
```

##### 5. `createDeleteMock(error?)`

Helper for delete().eq() pattern.

```typescript
const deleteMock = createDeleteMock();

mockSupabase.from.mockReturnValue({
  delete: deleteMock.delete,
});

// This pattern works:
await supabase
  .from('users')
  .delete()
  .eq('id', '1');
```

#### Real-World Examples

**Example 1: Testing Auto-Response Service**

```typescript
// src/services/__tests__/messageAutoResponseService.test.ts
import { createSupabaseMock } from '@/test/utils/supabaseMock';

describe('MessageAutoResponseService', () => {
  it('should return null when no rules are enabled', async () => {
    const autoResponseMock = createSupabaseMock({
      table: 'message_auto_responses',
      data: [], // No rules
    });

    mockSupabase.from.mockImplementation((tableName: string) => {
      if (tableName === 'message_auto_responses') {
        return autoResponseMock.chainMock;
      }
      return createSupabaseMock({ table: tableName, data: [] }).chainMock;
    });

    const response = await messageAutoResponseService.checkAutoResponse(
      mockMessage,
      'channel-1',
      'user-2'
    );

    expect(response).toBeNull();
  });
});
```

**Example 2: Multi-Table Mocking**

```typescript
import { mockSupabaseClient, createSupabaseMock } from '@/test/utils/supabaseMock';

it('should fetch user with their posts', async () => {
  const mockClient = mockSupabaseClient({
    users: createSupabaseMock({
      table: 'users',
      data: [{ id: '1', name: 'Alice' }],
      single: true,
    }),
    posts: createSupabaseMock({
      table: 'posts',
      data: [
        { id: 'p1', user_id: '1', title: 'First Post' },
        { id: 'p2', user_id: '1', title: 'Second Post' },
      ],
    }),
  });

  mockSupabase.from = mockClient.from;

  // Service code can query multiple tables
  const user = await getUserWithPosts('1');

  expect(user.name).toBe('Alice');
  expect(user.posts).toHaveLength(2);
});
```

**Example 3: Testing Error Handling**

```typescript
it('should handle database errors gracefully', async () => {
  const errorMock = createSupabaseMock({
    table: 'message_auto_responses',
    error: new Error('Database connection failed'),
  });

  mockSupabase.from.mockReturnValue(errorMock.chainMock);

  const response = await messageAutoResponseService.checkAutoResponse(
    mockMessage,
    'channel-1',
    'user-2'
  );

  expect(response).toBeNull(); // Service handles error gracefully
});
```

#### Supported Query Methods

The mock supports all common Supabase query methods:

**Selection & Filtering**:
- `select(columns)`
- `eq(column, value)`
- `neq(column, value)`
- `gt(column, value)`, `gte(column, value)`
- `lt(column, value)`, `lte(column, value)`
- `like(column, pattern)`
- `ilike(column, pattern)` (case-insensitive)
- `is(column, value)` (null checks)
- `in(column, values)`
- `contains(column, values)`
- `containedBy(column, values)`

**Modification**:
- `insert(data)`
- `update(data)`
- `delete()`
- `upsert(data)`

**Pagination & Ordering**:
- `order(column, options)`
- `limit(count)`
- `offset(count)`
- `range(from, to)`

**Result Formatting**:
- `single()` - Returns single record or error
- `maybeSingle()` - Returns single record or null

#### When to Use

Use `supabaseMock` utilities when testing:
- Services that query Supabase tables
- CRUD operations (Create, Read, Update, Delete)
- Complex query chains with multiple filters
- Error handling in database operations
- Multi-table queries

---

### IndexedDB Testing

**Location**: `src/test/utils/indexedDBMock.ts`

**Purpose**: Complete mock implementation of IndexedDB API for testing client-side storage

#### Why This Utility Exists

IndexedDB is a browser API not available in Node.js test environments. Services that use IndexedDB (like `rateLimitService`) require a complete mock that:

1. Simulates async behavior with proper event handling
2. Supports transactions and object stores
3. Maintains data consistency across operations
4. Provides realistic success/error callbacks

The `indexedDBMock` utility provides a full-featured IndexedDB implementation for testing.

#### Basic Setup

**CRITICAL**: Setup must happen BEFORE importing the service being tested.

```typescript
// CORRECT: Setup before import
import { setupIndexedDBMock } from '@/test/utils/indexedDBMock';
setupIndexedDBMock(); // Must come first!

import { rateLimitService } from '../rateLimitService';

// WRONG: Import before setup
import { rateLimitService } from '../rateLimitService'; // Service uses indexedDB on import!
import { setupIndexedDBMock } from '@/test/utils/indexedDBMock';
setupIndexedDBMock(); // Too late - service already tried to use indexedDB
```

**Why**: Many services instantiate on import and immediately try to open IndexedDB. The mock must be in place before the import happens.

#### API Reference

##### `setupIndexedDBMock()`

Sets up IndexedDB mock in global scope. Call once in your test file.

```typescript
import { setupIndexedDBMock } from '@/test/utils/indexedDBMock';

// At top of test file, before other imports
setupIndexedDBMock();
```

This creates global objects:
- `global.indexedDB` - MockIDBFactory instance
- `global.IDBRequest` - MockIDBRequest class
- `global.IDBTransaction` - MockIDBTransaction class
- `global.IDBObjectStore` - MockIDBObjectStore class
- `global.IDBDatabase` - MockIDBDatabase class

#### Real-World Example: Testing Rate Limit Service

```typescript
// src/services/__tests__/rateLimitService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// CRITICAL: Setup IndexedDB mock BEFORE importing the service
import { setupIndexedDBMock } from '@/test/utils/indexedDBMock';
setupIndexedDBMock();

import { rateLimitService, RATE_LIMITS } from '../rateLimitService';

describe('RateLimitService', () => {
  const testUserId = 'test-user-123';

  beforeEach(async () => {
    vi.clearAllMocks();
    // Clear all rate limits before each test
    await rateLimitService.clearAll();
  });

  it('should allow requests within limit', async () => {
    const result = await rateLimitService.checkLimit('message_send', testUserId);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
    expect(result.retryAfter).toBe(0);
  });

  it('should track multiple requests correctly', async () => {
    // Record 3 requests
    await rateLimitService.recordRequest('file_upload', testUserId);
    await rateLimitService.recordRequest('file_upload', testUserId);
    await rateLimitService.recordRequest('file_upload', testUserId);

    const status = await rateLimitService.getStatus('file_upload', testUserId);

    expect(status.remaining).toBe(RATE_LIMITS.file_upload.maxRequests - 3);
  });

  it('should enforce rate limits', async () => {
    const limit = RATE_LIMITS.api_anthropic.maxRequests;

    // Fill up the limit
    for (let i = 0; i < limit; i++) {
      await rateLimitService.recordRequest('api_anthropic', testUserId);
    }

    // Next request should be rejected
    const result = await rateLimitService.checkLimit('api_anthropic', testUserId);

    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });
});
```

#### Mock Implementation Details

**Async Behavior**: The mock uses `queueMicrotask()` to simulate IndexedDB's asynchronous nature:

```typescript
const request = store.get('key-1');

// Callback fires asynchronously, just like real IndexedDB
request.onsuccess = (event) => {
  console.log('This happens later');
};

console.log('This happens first');
```

**Event Handling**: Supports both success and error callbacks:

```typescript
const request = store.add({ id: 'duplicate' }, 'key-1');

request.onsuccess = (event) => {
  // Called on success
};

request.onerror = (event) => {
  // Called on error (e.g., duplicate key)
};
```

**Data Persistence**: Data is shared across transactions within the same test:

```typescript
// First transaction: Write data
const tx1 = db.transaction(['items'], 'readwrite');
tx1.objectStore('items').put({ id: '1', value: 'test' });

// Second transaction: Read data
const tx2 = db.transaction(['items'], 'readonly');
const getRequest = tx2.objectStore('items').get('1');

getRequest.onsuccess = (event) => {
  console.log(event.target.result); // { id: '1', value: 'test' }
};
```

#### When to Use

Use `indexedDBMock` when testing:
- Services that use IndexedDB for storage
- Rate limiting and quota tracking
- Client-side caching mechanisms
- Offline-first functionality
- Progressive Web App (PWA) features

---

## Common Test Scenarios

### Testing File Uploads and Validation

```typescript
import { describe, it, expect } from 'vitest';
import { createMockFile } from '@/test/utils/filePolyfill';
import { fileUploadService } from '@/services/fileUploadService';

describe('File Upload Service', () => {
  it('should accept valid files', async () => {
    const file = createMockFile('test content', 'document.txt', 'text/plain');

    const result = await fileUploadService.validateAndUpload(file);

    expect(result.success).toBe(true);
    expect(result.fileId).toBeDefined();
  });

  it('should reject oversized files', async () => {
    // Create 20MB file (over limit)
    const largeData = new Uint8Array(20 * 1024 * 1024);
    const file = createMockFile(largeData, 'large.bin', 'application/octet-stream');

    const result = await fileUploadService.validateAndUpload(file);

    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds maximum size');
  });

  it('should validate file magic numbers', async () => {
    // Malicious file: claims to be PNG but has EXE magic number
    const exeMagic = new Uint8Array([0x4D, 0x5A]); // MZ header
    const file = createMockFile(exeMagic, 'fake.png', 'image/png');

    const result = await fileUploadService.validateAndUpload(file);

    expect(result.success).toBe(false);
    expect(result.error).toContain('File type mismatch');
  });
});
```

### Testing Database Operations

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock, createInsertMock } from '@/test/utils/supabaseMock';
import { userService } from '@/services/userService';

describe('User Service', () => {
  it('should fetch user by ID', async () => {
    const mockUser = { id: '1', name: 'Alice', email: 'alice@example.com' };

    const usersMock = createSupabaseMock({
      table: 'users',
      data: [mockUser],
      single: true,
    });

    mockSupabase.from.mockReturnValue(usersMock.chainMock);

    const user = await userService.getUserById('1');

    expect(user).toEqual(mockUser);
    expect(mockSupabase.from).toHaveBeenCalledWith('users');
  });

  it('should create new user', async () => {
    const newUser = {
      id: '2',
      name: 'Bob',
      email: 'bob@example.com',
      created_at: new Date().toISOString(),
    };

    const insertMock = createInsertMock(newUser);

    mockSupabase.from.mockReturnValue({
      insert: insertMock.insert,
    });

    const result = await userService.createUser({
      name: 'Bob',
      email: 'bob@example.com',
    });

    expect(result.id).toBe('2');
  });
});
```

### Testing Concurrent Operations

```typescript
import { describe, it, expect } from 'vitest';
import { setupIndexedDBMock } from '@/test/utils/indexedDBMock';
setupIndexedDBMock();

import { rateLimitService, RATE_LIMITS } from '@/services/rateLimitService';

describe('Concurrent Request Handling', () => {
  it('should handle concurrent rate limit checks', async () => {
    const userId = 'concurrent-user';

    // Fire 10 concurrent requests
    const promises = Array.from({ length: 10 }, () =>
      rateLimitService.checkAndRecord('message_send', userId)
    );

    const results = await Promise.all(promises);

    // All should succeed (within limit)
    results.forEach(result => {
      expect(result.allowed).toBe(true);
    });

    // Verify total count
    const status = await rateLimitService.getStatus('message_send', userId);
    expect(status.remaining).toBe(
      RATE_LIMITS.message_send.maxRequests - 10
    );
  });
});
```

### Testing Error Handling

```typescript
describe('Error Handling', () => {
  it('should handle network errors', async () => {
    const errorMock = createSupabaseMock({
      table: 'users',
      error: { message: 'Network request failed', code: 'NETWORK_ERROR' },
    });

    mockSupabase.from.mockReturnValue(errorMock.chainMock);

    const result = await userService.fetchUsers();

    expect(result.success).toBe(false);
    expect(result.error).toContain('Network');
  });

  it('should provide meaningful error messages', async () => {
    const file = createMockFile('content', 'file.xyz', 'application/unknown');

    const result = await fileSecurityService.validateFile(file);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Unsupported file type');
  });
});
```

---

## Vitest 4.0.18 Compatibility

### Key Differences from Jest

Vitest is Jest-compatible but has some differences:

**Imports**: Import from `vitest` instead of using globals

```typescript
// Vitest
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Jest (old)
// describe, it, expect are globals
```

**Mocking**: Use `vi` instead of `jest`

```typescript
// Vitest
vi.mock('./module');
vi.fn();
vi.spyOn(obj, 'method');

// Jest (old)
jest.mock('./module');
jest.fn();
jest.spyOn(obj, 'method');
```

### Correct Assertion Patterns

#### Type Checking

```typescript
// Type checks
expect(typeof value).toBe('string');
expect(typeof value).toBe('number');
expect(Array.isArray(value)).toBe(true);
expect(value).toBeInstanceOf(Date);
```

#### Truthiness

```typescript
// Truthiness checks
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeDefined();
expect(value).toBeUndefined();
expect(value).toBeNull();
```

#### Numbers

```typescript
// Number comparisons
expect(value).toBe(42);
expect(value).toBeGreaterThan(10);
expect(value).toBeGreaterThanOrEqual(10);
expect(value).toBeLessThan(100);
expect(value).toBeLessThanOrEqual(100);
```

#### Arrays and Objects

```typescript
// Array checks
expect(array).toHaveLength(3);
expect(array).toContain(item);
expect(array).toContainEqual({ id: 1, name: 'Alice' });
expect(array).toEqual([1, 2, 3]); // Deep equality

// Object checks
expect(obj).toEqual({ id: 1, name: 'Alice' }); // Deep equality
expect(obj).toMatchObject({ id: 1 }); // Partial match
expect(obj).toHaveProperty('name');
expect(obj).toHaveProperty('name', 'Alice');
```

#### Async Operations

```typescript
// Promise assertions
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow('error message');

// Alternative: resolve first
const result = await promise;
expect(result).toBe(value);
```

#### Function Calls

```typescript
// Mock function assertions
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(3);
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
expect(mockFn).toHaveBeenLastCalledWith('arg1', 'arg2');
```

### Async Test Timing

Use `done` callback or `async/await` for proper async handling:

```typescript
// Using done callback
it('should complete async operation', (done) => {
  const request = indexedDB.open('db', 1);
  request.onsuccess = () => {
    expect(request.result).toBeDefined();
    done(); // Signal completion
  };
});

// Using async/await
it('should complete async operation', async () => {
  const result = await new Promise((resolve) => {
    const request = indexedDB.open('db', 1);
    request.onsuccess = () => resolve(request.result);
  });

  expect(result).toBeDefined();
});
```

---

## Best Practices

### Test Isolation and Cleanup

```typescript
describe('Service Tests', () => {
  beforeEach(async () => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Clear any cached data
    cacheService.clear();

    // Reset database state (for IndexedDB tests)
    await rateLimitService.clearAll();

    // Reset localStorage
    localStorage.clear();
  });

  afterEach(() => {
    // Clean up any test resources
    vi.restoreAllMocks();
  });
});
```

### Mocking Strategies

#### Mock at Module Level

```typescript
// Mock the entire module
vi.mock('@/services/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Import after mocking
import { service } from '@/services/myService';
```

#### Use Test Utilities

```typescript
// GOOD: Reusable utility
import { createSupabaseMock } from '@/test/utils/supabaseMock';

const mock = createSupabaseMock({ table: 'users', data: mockData });

// BAD: Manual mock in every test
const mock = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  // ... many more methods
};
```

### Test Organization

#### Group Related Tests

```typescript
describe('UserService', () => {
  describe('getUserById', () => {
    it('should return user when found', async () => {});
    it('should throw error when not found', async () => {});
  });

  describe('createUser', () => {
    it('should create user with valid data', async () => {});
    it('should validate required fields', async () => {});
  });
});
```

#### Use Descriptive Test Names

```typescript
// GOOD: Clear, specific
it('should reject files larger than 10MB', async () => {});
it('should return 429 when rate limit exceeded', async () => {});

// BAD: Vague, unclear
it('should work', async () => {});
it('should handle files', async () => {});
```

#### Follow AAA Pattern

**Arrange-Act-Assert** pattern for clear test structure:

```typescript
it('should process user data', async () => {
  // Arrange: Set up test data and mocks
  const mockUser = { id: '1', name: 'Alice' };
  const usersMock = createSupabaseMock({
    table: 'users',
    data: [mockUser],
  });
  mockSupabase.from.mockReturnValue(usersMock.chainMock);

  // Act: Execute the code being tested
  const result = await service.processUser('1');

  // Assert: Verify the outcome
  expect(result.processed).toBe(true);
  expect(result.userName).toBe('Alice');
});
```

---

## Troubleshooting

### Common Test Failures

#### Problem: "Cannot read property 'arrayBuffer' of undefined"

**Solution**: Use `createMockFile` utility:

```typescript
// FAILS: Native File lacks arrayBuffer() in Node.js
const file = new File(['content'], 'test.txt');
await file.arrayBuffer(); // Error!

// WORKS: Mock adds arrayBuffer() method
import { createMockFile } from '@/test/utils/filePolyfill';
const file = createMockFile('content', 'test.txt', 'text/plain');
await file.arrayBuffer(); // Works!
```

#### Problem: "IndexedDB is not defined"

**Solution**: Setup IndexedDB mock before importing service:

```typescript
// FAILS: Import before mock setup
import { rateLimitService } from '../rateLimitService';
import { setupIndexedDBMock } from '@/test/utils/indexedDBMock';
setupIndexedDBMock(); // Too late!

// WORKS: Mock before import
import { setupIndexedDBMock } from '@/test/utils/indexedDBMock';
setupIndexedDBMock(); // Must come first!

import { rateLimitService } from '../rateLimitService';
```

#### Problem: "Supabase query chain returns undefined"

**Solution**: Use `createSupabaseMock` utility:

```typescript
// INCOMPLETE: Missing chain methods
mockSupabase.from.mockReturnValue({
  select: vi.fn().mockResolvedValue({ data: mockData }),
});

// COMPLETE: Handles full chain
import { createSupabaseMock } from '@/test/utils/supabaseMock';

const mock = createSupabaseMock({
  table: 'users',
  data: mockData,
});

mockSupabase.from.mockReturnValue(mock.chainMock);
```

#### Problem: "Test timeout after 10000ms"

**Solution**: Use `done` callback or wrap in Promise:

```typescript
// Solution 1: Use done callback
it('should complete operation', (done) => {
  service.asyncOperation((result) => {
    expect(result).toBeDefined();
    done(); // Signal completion
  });
});

// Solution 2: Wrap in Promise
it('should complete operation', async () => {
  const result = await new Promise((resolve) => {
    service.asyncOperation(resolve);
  });

  expect(result).toBeDefined();
});
```

#### Problem: "Tests pass individually but fail when run together"

**Solution**: Clear state in `beforeEach`:

```typescript
beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  cacheService.clear();
  await rateLimitService.clearAll();
});
```

### Debugging Tests

```bash
# Run specific test file
npm test rateLimitService.test.ts

# Run specific test case
npm test -- -t "should enforce rate limits"

# Add console.logs
console.log('Mock calls:', mockSupabase.from.mock.calls);

# Use test-only modifier
it.only('should process data', async () => {
  // ... test code
});
```

---

## Additional Resources

### Documentation Files

- **Test Utilities README**: `src/test/utils/README.md`
- **File Polyfill Examples**: `src/test/utils/filePolyfill.example.md`
- **Test Completion Plan**: `TEST_COMPLETION_PLAN.md`

### Example Test Files

- **File Security Service**: `src/services/__tests__/fileSecurityService.test.ts`
- **Message Auto-Response Service**: `src/services/__tests__/messageAutoResponseService.test.ts`
- **Rate Limit Service**: `src/services/__tests__/rateLimitService.test.ts`

### Configuration Files

- **Vitest Config**: `vitest.config.ts`
- **Package.json**: Test scripts

---

**Version**: 2.0
**Last Updated**: February 11, 2026
**Vitest Version**: 4.0.18
**Test Pass Rate**: 100% (all service tests passing)

---

## Recent Updates (February 2026)

### Messages Component Layout Fix

**Fixed**: Critical JSX syntax error and layout issues in Messages component

**Changes**:
1. **Fixed JSX Structure** - Corrected MessageInputPortal placement within Pulse container
2. **Added Full MessageInput** - Restored Tools menu, audio recording, AI features
3. **Fixed FeatureSettingsPanel** - Resolved `isPriority is not defined` error
4. **Layout Architecture** - Implemented standard messaging app layout:
   - Fixed header (search bar, user info)
   - Fixed sidebar (thread/contact selection)
   - Scrollable messages area (shows last message, scroll up for history)
   - Fixed input at bottom (aligned with header, not overlapping sidebar)

**Files Modified**:
- [Messages.tsx](../src/components/Messages.tsx#L4236-L4260) - Fixed input rendering
- [FeatureSettingsPanel.tsx](../src/components/Messages/FeatureSettingsPanel.tsx#L261) - Variable scope fix

### Performance Optimization

**Achieved**: 76% reduction in initial bundle size (8.85 MB → 2.1 MB)

**Optimizations Applied**:
1. **Vendor Bundle Splitting** - Split 2.93 MB vendor into 7 targeted chunks
2. **Route-Based Code Splitting** - Feature bundles load only when accessed
3. **Lazy Loading** - Heavy libraries (AI, office processors) load on-demand

**Impact**:
- Initial Load: 76% smaller
- Time to Interactive: 75% faster (~15s → ~3-4s on 4G)
- First Contentful Paint: 76% faster (~5s → ~1.2s)

See [PERFORMANCE_OPTIMIZATION.md](./PERFORMANCE_OPTIMIZATION.md) for detailed metrics and implementation guide.

**Files Modified**:
- [vite.config.ts](../vite.config.ts#L36-L110) - Enhanced code splitting strategy

### Testing Status

**Current State**: All critical tests passing

Run tests:
```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
```

**Known Issues**:
- Some integration tests may need updates due to Messages component changes
- Performance tests should be added to validate bundle size targets

---

*Last Updated: February 15, 2026*
