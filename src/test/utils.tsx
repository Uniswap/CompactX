import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiConfig, createConfig } from 'wagmi';
import { http } from 'viem';
import { PropsWithChildren } from 'react';
import { Chain } from 'viem';

const testChain = {
  id: 1,
  name: 'Test Chain',
  nativeCurrency: {
    decimals: 18,
    name: 'Test Ether',
    symbol: 'TEST',
  },
  rpcUrls: {
    public: { http: ['http://localhost:8545'] },
    default: { http: ['http://localhost:8545'] },
  },
  blockExplorers: {
    default: { name: 'TestExplorer', url: 'http://localhost:8545' },
  },
} as const satisfies Chain;

const config = createConfig({
  chains: [testChain],
  transports: {
    [testChain.id]: http(),
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

export function createWrapper() {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <WagmiConfig config={config}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </WagmiConfig>
    );
  };
}
