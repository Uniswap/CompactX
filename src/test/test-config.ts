import { mainnet } from 'wagmi/chains';
import { QueryClient } from '@tanstack/react-query';
import { createConfig } from 'wagmi';
import { http } from 'viem';

// Create a test chain with minimal configuration
const chain = {
  ...mainnet,
  rpcUrls: {
    ...mainnet.rpcUrls,
    default: { http: ['http://localhost:8545'] },
  },
};

// Create mock wagmi config
export const testConfig = createConfig({
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
    },
  },
});
