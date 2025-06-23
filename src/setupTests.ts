import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock indexedDB
const indexedDBMock = {
  open: vi.fn().mockReturnValue({
    result: {
      createObjectStore: vi.fn(),
      transaction: vi.fn().mockReturnValue({
        objectStore: vi.fn().mockReturnValue({
          put: vi.fn(),
          getAll: vi.fn().mockResolvedValue([]),
          get: vi.fn().mockResolvedValue(null),
          delete: vi.fn(),
          clear: vi.fn()
        }),
        oncomplete: null
      })
    },
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null
  })
};

// Mock browser APIs
global.indexedDB = indexedDBMock as any;
global.IDBKeyRange = { bound: vi.fn() } as any;

// Mock window.URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = vi.fn();

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Setup global mocks for Jest compatibility with Vitest
// Temporarily commented out to troubleshoot test failures
/*
global.jest = {
  fn: vi.fn,
  mock: (path: string, factory?: any) => {
    const pathToUse = path.startsWith('./') || path.startsWith('../') 
      ? path 
      : `./${path}`;
    return vi.mock(pathToUse, factory);
  }
} as any;
*/
global.jest = {
  fn: vi.fn,
  mock: vi.fn
} as any;

// Mock ImageData for PDF processing tests - lightweight version
global.ImageData = vi.fn().mockImplementation((width: number, height: number) => ({
  data: new Uint8ClampedArray(4),
  width: width || 1,
  height: height || 1
})) as any;
