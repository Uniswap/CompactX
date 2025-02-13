import { ReactNode } from 'react';
import { WagmiConfig } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { testConfig, testQueryClient } from './test-config';

export function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={testQueryClient}>
      <WagmiConfig config={testConfig}>{children}</WagmiConfig>
    </QueryClientProvider>
  );
}
