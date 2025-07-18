import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { vi } from 'vitest';
import { afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock CSS modules
vi.mock('*.css', () => ({}));
vi.mock('*.scss', () => ({}));

// Add missing DOM APIs that React Testing Library needs
if (typeof window !== 'undefined') {
  // Mock createRange - required by many components
  if (!document.createRange) {
    document.createRange = () => {
      const range = new Range();

      range.setStart = vi.fn();
      range.setEnd = vi.fn();
      range.commonAncestorContainer = {
        nodeName: 'BODY',
        ownerDocument: document,
      } as any;
      range.selectNode = vi.fn();
      range.selectNodeContents = vi.fn();
      range.collapse = vi.fn();
      range.cloneContents = vi.fn();
      range.deleteContents = vi.fn();
      range.detach = vi.fn();
      range.extractContents = vi.fn();
      range.getBoundingClientRect = vi.fn(() => ({
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));
      range.getClientRects = vi.fn(() => ({
        item: vi.fn(),
        length: 0,
        [Symbol.iterator]: vi.fn(),
      }));
      range.createContextualFragment = vi.fn((html: string) => {
        const template = document.createElement('template');
        template.innerHTML = html;
        return template.content;
      });
      range.insertNode = vi.fn();
      range.intersectsNode = vi.fn();
      range.compareBoundaryPoints = vi.fn();
      range.comparePoint = vi.fn();
      range.cloneRange = vi.fn();
      range.toString = vi.fn(() => '');
      range.surroundContents = vi.fn();

      return range as any;
    };
  }

  // Mock getSelection - used by some UI libraries
  if (!window.getSelection) {
    window.getSelection = vi.fn(() => ({
      rangeCount: 0,
      addRange: vi.fn(),
      removeAllRanges: vi.fn(),
      getRangeAt: vi.fn(),
      collapse: vi.fn(),
      collapseToEnd: vi.fn(),
      collapseToStart: vi.fn(),
      containsNode: vi.fn(),
      deleteFromDocument: vi.fn(),
      empty: vi.fn(),
      extend: vi.fn(),
      modify: vi.fn(),
      removeRange: vi.fn(),
      selectAllChildren: vi.fn(),
      setBaseAndExtent: vi.fn(),
      setPosition: vi.fn(),
      toString: vi.fn(() => ''),
      anchorNode: null,
      anchorOffset: 0,
      focusNode: null,
      focusOffset: 0,
      isCollapsed: true,
      type: 'None',
    })) as any;
  }

  // Mock Element.prototype.scrollIntoView if not available
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }

  // Mock HTMLElement methods that might be missing
  if (!HTMLElement.prototype.hasOwnProperty('inert')) {
    Object.defineProperty(HTMLElement.prototype, 'inert', {
      get() {
        try {
          // Use hasAttribute which is safer than getAttribute
          return this.hasAttribute && this.hasAttribute('inert');
        } catch (e) {
          return false;
        }
      },
      set(value) {
        try {
          if (this.setAttribute && this.removeAttribute) {
            if (value) {
              this.setAttribute('inert', '');
            } else {
              this.removeAttribute('inert');
            }
          }
        } catch (e) {
          // Silently ignore if element doesn't support these methods
        }
      },
      configurable: true,
    });
  }
}

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
global.ImageData = vi.fn().mockImplementation((dataOrWidth, heightOrWidth?, height?) => {
  // Handle both constructors: new ImageData(data, width, height) and new ImageData(width, height)
  if (dataOrWidth instanceof Uint8ClampedArray) {
    // Constructor: new ImageData(data, width, height)
    return {
      data: dataOrWidth,
      width: heightOrWidth,
      height: height,
    };
  } else {
    // Constructor: new ImageData(width, height)
    const width = dataOrWidth;
    const actualHeight = heightOrWidth;
    return {
      width,
      height: actualHeight,
      data: new Uint8ClampedArray(width * actualHeight * 4),
    };
  }
});

// Mock window.CSS if needed
if (typeof window !== 'undefined' && !window.CSS) {
  window.CSS = {
    supports: () => false,
    escape: (str: string) => str,
  } as any;
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
};
