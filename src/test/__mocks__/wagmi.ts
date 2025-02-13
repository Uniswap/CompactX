import { vi } from 'vitest';
import type { HttpTransport } from 'viem';
import type { Config } from '@wagmi/core';

// Mock http transport
const mockRequest = vi.fn();
export const http = vi.fn(() => ({
  request: mockRequest,
  type: 'http',
})) as unknown as () => HttpTransport;

// Mock chain
export const mainnet = {
  id: 1,
  name: 'Mainnet',
  network: 'mainnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://eth-mainnet.mock.com'] },
  },
};

// Mock configs
export const getDefaultConfig = vi.fn(() => ({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
})) as unknown as (config: any) => Config;

export const createConfig = vi.fn(() => ({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
})) as unknown as (config: any) => Config;

// Mock hooks
export const useAccount = vi.fn(() => ({
  address: '0x1234567890123456789012345678901234567890',
  isConnected: true,
  status: 'connected',
}));

export const useNetwork = vi.fn(() => ({
  chain: mainnet,
  chains: [mainnet],
}));

export const useConnect = vi.fn(() => ({
  connect: vi.fn(),
  connectors: [],
  status: 'ready',
}));

export const useSignMessage = vi.fn(() => ({
  signMessage: vi.fn(),
  signMessageAsync: vi.fn().mockResolvedValue('0xmocksignature'),
  status: 'idle',
}));

// Mock components
export const WagmiConfig = ({ children }: { children: React.ReactNode }) => children;

// Mock utilities
export const getWalletClient = vi.fn().mockResolvedValue({
  account: {
    address: '0x1234567890123456789012345678901234567890',
  },
  chain: mainnet,
  transport: http(),
});

export const getPublicClient = vi.fn().mockResolvedValue({
  chain: mainnet,
  transport: http(),
});
