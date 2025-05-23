import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Layout } from '../components/Layout';
import { WagmiConfig } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '../config/wallet';
import { AuthProvider } from '../contexts/AuthContext';
import { AllocatorProvider } from '../contexts/AllocatorContext';

// Create a client for React Query
const queryClient = new QueryClient();

// Create a wrapper component for testing
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <WagmiConfig config={config}>
      <RainbowKitProvider modalSize="compact">
        <AuthProvider>
          <AllocatorProvider>{children}</AllocatorProvider>
        </AuthProvider>
      </RainbowKitProvider>
    </WagmiConfig>
  </QueryClientProvider>
);

describe('Layout Component', () => {
  it('renders the header with title', () => {
    render(
      <TestWrapper>
        <Layout>
          <div>Test Content</div>
        </Layout>
      </TestWrapper>
    );

    expect(screen.getByText(/Com/)).toBeInTheDocument();
    expect(screen.getByText(/pac/)).toBeInTheDocument();
    expect(screen.getByText(/tX/)).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('includes the ConnectButton component', () => {
    render(
      <TestWrapper>
        <Layout>
          <div>Test Content</div>
        </Layout>
      </TestWrapper>
    );

    // RainbowKit's ConnectButton renders a button with role="button"
    const connectButton = screen.getByRole('button');
    expect(connectButton).toBeInTheDocument();
  });
});
