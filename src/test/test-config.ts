import { mainnet } from 'wagmi/chains';
import { QueryClient } from '@tanstack/react-query';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'viem';

// Create a test chain with minimal configuration
const chain = {
  ...mainnet,
  rpcUrls: {
    ...mainnet.rpcUrls,
    default: { http: ['http://localhost:8545'] },
  },
};

// Create mock wagmi config using RainbowKit's getDefaultConfig
export const testConfig = getDefaultConfig({
  appName: 'CompactX Test',
  projectId: 'test-project-id',
  chains: [chain],
  transports: {
    [chain.id]: http(),
  },
});

// Create a test query client
export const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
    },
  },
});
