import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock CSS modules
vi.mock('*.css', () => ({}));
vi.mock('*.scss', () => ({}));

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

// Mock ImageData for canvas operations
global.ImageData = vi.fn().mockImplementation((width, height) => ({
  width,
  height,
  data: new Uint8ClampedArray(width * height * 4),
}));

// Mock window.CSS if needed
if (typeof window !== 'undefined' && !window.CSS) {
  window.CSS = {
    supports: () => false,
    escape: (str: string) => str,
  } as any;
}
