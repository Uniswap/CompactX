import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Layout } from '../components/Layout';
import { WagmiConfig } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '../config/wallet';
import { AuthProvider } from '../contexts/AuthContext';

// Mock wagmi hooks
vi.mock('wagmi', async () => {
  const actual = await vi.importActual('wagmi');
  return {
    ...actual,
    useAccount: () => ({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
    }),
    useSignMessage: () => ({
      signMessageAsync: vi.fn().mockResolvedValue('0xsignature'),
    }),
  };
});

// Mock smallocator API
vi.mock('../api/smallocator', () => ({
  smallocator: {
    verifySession: vi.fn().mockResolvedValue({ valid: true, session: { address: '0x1234' } }),
    getSessionPayload: vi.fn().mockResolvedValue({
      session: {
        domain: 'test.com',
        address: '0x1234',
        statement: 'Sign in',
        uri: 'https://test.com',
        version: '1',
        chainId: '1',
        nonce: '123',
        issuedAt: '2025-01-01T00:00:00.000Z',
        expirationTime: '2025-01-02T00:00:00.000Z',
      },
    }),
    createSession: vi.fn().mockResolvedValue({}),
    clearSession: vi.fn().mockResolvedValue({}),
  },
}));

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

// Create a wrapper component for testing
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <WagmiConfig config={config}>
      <RainbowKitProvider modalSize="compact">
        <AuthProvider>{children}</AuthProvider>
      </RainbowKitProvider>
    </WagmiConfig>
  </QueryClientProvider>
);

describe('Layout Component', () => {
  it('renders the header with title', async () => {
    render(
      <TestWrapper>
        <Layout>
          <div>Test Content</div>
        </Layout>
      </TestWrapper>
    );

    // Wait for auth check to complete and verify title parts
    const titleContainer = await screen.findByRole('heading');
    expect(titleContainer).toHaveTextContent('CompactX');
    expect(screen.getByText('Com')).toBeInTheDocument();
    expect(screen.getByText('pac')).toBeInTheDocument();
    expect(screen.getByText('tX')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('includes the ConnectButton component', async () => {
    render(
      <TestWrapper>
        <Layout>
          <div>Test Content</div>
        </Layout>
      </TestWrapper>
    );

    // RainbowKit's ConnectButton renders a button with specific test id
    const connectButton = await screen.findByTestId('rk-connect-button');
    expect(connectButton).toBeInTheDocument();
  });
});
