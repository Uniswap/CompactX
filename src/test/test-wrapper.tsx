import { ReactNode } from 'react';
import { WagmiConfig } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultWallets } from '@rainbow-me/rainbowkit';
import { testQueryClient } from './test-config';
import { AuthProvider } from '../contexts/AuthContext';
import { http } from 'viem';
import { mainnet } from 'wagmi/chains';
import { createConfig } from 'wagmi';
import '@rainbow-me/rainbowkit/styles.css';

const testChain = mainnet;

const { wallets } = getDefaultWallets({
  appName: 'CompactX Test',
  projectId: 'test-project-id',
  chains: [testChain],
});

const config = createConfig({
  chains: [testChain],
  transports: {
    [testChain.id]: http(),
  },
});

export function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={testQueryClient}>
      <WagmiConfig config={config}>
        <RainbowKitProvider appInfo={{ appName: 'CompactX Test' }} chains={[testChain]} initialChain={testChain}>
          <AuthProvider>{children}</AuthProvider>
        </RainbowKitProvider>
      </WagmiConfig>
    </QueryClientProvider>
  );
}
