// ============================================
// TEST SETUP FILE
// Global test configuration and mocks
// ============================================

import '@testing-library/jest-dom';
import { vi, afterEach } from 'vitest';

// Mock environment variables
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('VITE_GEMINI_API_KEY', 'test-gemini-key');

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

// Mock crypto for webhook signature verification
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      importKey: vi.fn().mockResolvedValue({}),
      sign: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    },
    getRandomValues: vi.fn((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    }),
  },
});

// Mock AudioContext
class MockAudioContext {
  createMediaStreamSource = vi.fn();
  createAnalyser = vi.fn(() => ({
    connect: vi.fn(),
    fftSize: 0,
    frequencyBinCount: 0,
    getByteFrequencyData: vi.fn(),
  }));
  close = vi.fn();
}

global.AudioContext = MockAudioContext as any;
(global as any).webkitAudioContext = MockAudioContext;

// Mock MediaRecorder
class MockMediaRecorder {
  ondataavailable: ((e: any) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((e: any) => void) | null = null;

  start = vi.fn();
  stop = vi.fn(() => {
    if (this.onstop) this.onstop();
  });
}

global.MediaRecorder = MockMediaRecorder as any;

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  },
});

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});
