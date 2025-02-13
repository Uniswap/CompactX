import { vi } from 'vitest';

export const RainbowKitProvider = ({ children }: { children: React.ReactNode }) => children;

export const getDefaultConfig = vi.fn(() => ({
  // Mock implementation of RainbowKit config
  chains: [],
  transports: {},
}));
