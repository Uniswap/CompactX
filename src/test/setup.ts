import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Create a shared mediaQueryList object for consistent behavior
const mediaQueryList = {
  matches: false,
  media: '',
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
};

// Mock window.matchMedia for Ant Design
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation(query => ({
    ...mediaQueryList,
    media: query,
    matches: false,
  })),
});

// Mock ResizeObserver
class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

window.ResizeObserver = ResizeObserver;

// Mock Ant Design's responsive observer
vi.mock('antd/lib/_util/responsiveObserver', () => {
  const subscribers = new Map();
  const responsiveMap = {
    xs: '(max-width: 575px)',
    sm: '(min-width: 576px)',
    md: '(min-width: 768px)',
    lg: '(min-width: 992px)',
    xl: '(min-width: 1200px)',
    xxl: '(min-width: 1600px)',
  };

  return {
    default: {
      _subscribers: subscribers,
      dispatch(pointMap: Record<string, boolean>) {
        subscribers.forEach(func => func(pointMap));
      },
      register(token: string, callback: (val: Record<string, boolean>) => void) {
        subscribers.set(token, callback);
        const pointMap = Object.keys(responsiveMap).reduce(
          (acc, screen) => {
            acc[screen] = false;
            return acc;
          },
          {} as Record<string, boolean>
        );
        callback(pointMap);
      },
      unregister(token: string) {
        subscribers.delete(token);
      },
      subscribe(callback: (val: Record<string, boolean>) => void) {
        const token = Symbol('responsive-token');
        this.register(token.toString(), callback);
        return token;
      },
    },
  };
});

// Cleanup after each test case
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
