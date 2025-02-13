import { ReactNode } from 'react';
import { WagmiConfig } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { testQueryClient } from './test-config';
import { AuthProvider } from '../contexts/AuthContext';
import { mainnet } from 'wagmi/chains';
import { createConfig } from 'wagmi';
import { http } from 'viem';

const config = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
});

export function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={testQueryClient}>
      <WagmiConfig config={config}>
        <RainbowKitProvider modalSize="compact">
          <AuthProvider>{children}</AuthProvider>
        </RainbowKitProvider>
      </WagmiConfig>
    </QueryClientProvider>
  );
}
