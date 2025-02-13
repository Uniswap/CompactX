import { vi } from 'vitest';

// Mock http transport
const mockHttp = vi.fn(() => ({
  request: vi.fn(),
}));

// Export http as both a named export and default export
export const http = mockHttp;
export default {
  http: mockHttp,
};

export const mainnet = {
  id: 1,
  name: 'Mainnet',
  network: 'mainnet',
  rpcUrls: {
    default: { http: ['https://eth-mainnet.g.alchemy.com/v2/your-api-key'] },
  },
};

export const getDefaultConfig = vi.fn(() => ({
  chains: [mainnet],
  transports: {
    [mainnet.id]: mockHttp(),
  },
}));

export const createConfig = vi.fn(() => ({
  chains: [mainnet],
  transports: {
    [mainnet.id]: mockHttp(),
  },
}));

export const useAccount = vi.fn(() => ({
  address: '0x1234567890123456789012345678901234567890',
  isConnected: true,
}));

export const useNetwork = vi.fn(() => ({
  chain: mainnet,
}));

export const useConnect = vi.fn(() => ({
  connect: vi.fn(),
  connectors: [],
}));

export const WagmiConfig = ({ children }: { children: React.ReactNode }) => children;
