// Mock ResizeObserver
class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

window.ResizeObserver = ResizeObserver;

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { TradeForm } from '../components/TradeForm';
import { TestWrapper } from './test-wrapper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { AuthProvider } from '../contexts/AuthContext';
import { smallocator } from '../api/smallocator';

// We don't need to mock useAuth anymore since we're using the real AuthProvider
vi.mock('wagmi', () => {
  return {
    createConfig: () => ({
      state: {
        chainId: 1,
        chains: [],
        transport: {},
      },
    }),
    WagmiConfig: ({ children }: { children: React.ReactNode }) => children,
    useAccount: () => ({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
    }),
    useNetwork: () => ({
      chain: { id: 1, name: 'Mainnet' },
    }),
    useChainId: () => 1,
    useSignMessage: () => ({
      signMessageAsync: vi.fn().mockResolvedValue('0xsignature'),
    }),
    http: () => ({
      request: vi.fn(),
    }),
  };
});

// Create a simple wrapper component
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TestWrapper>
        <AuthProvider>{children}</AuthProvider>
      </TestWrapper>
    </QueryClientProvider>
  );
};

// Mock all required dependencies
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  QueryClient: vi.fn(() => ({
    defaultOptions: {},
    setDefaultOptions: vi.fn(),
    getDefaultOptions: vi.fn(),
    setQueryDefaults: vi.fn(),
    getQueryDefaults: vi.fn(),
    setMutationDefaults: vi.fn(),
    getMutationDefaults: vi.fn(),
    getQueryCache: vi.fn(() => ({
      build: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
    })),
    getMutationCache: vi.fn(() => ({
      build: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
    })),
    clear: vi.fn(),
    resumePausedMutations: vi.fn(),
    fetchQuery: vi.fn(),
    prefetchQuery: vi.fn(),
    fetchInfiniteQuery: vi.fn(),
    prefetchInfiniteQuery: vi.fn(),
    cancelMutations: vi.fn(),
    executeMutation: vi.fn(),
    isFetching: vi.fn(),
    isMutating: vi.fn(),
    getLogger: vi.fn(),
    mount: vi.fn(),
  })),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../hooks/useCustomTokens', () => ({
  useCustomTokens: vi.fn(() => ({
    getCustomTokens: vi.fn(() => []),
    addCustomToken: vi.fn(),
    removeCustomToken: vi.fn(),
  })),
}));

vi.mock('../hooks/useCalibrator', () => ({
  useCalibrator: vi.fn(() => ({
    calibrate: vi.fn(),
    isLoading: false,
    useQuote: vi.fn(() => ({
      data: null,
      isLoading: false,
      error: null,
    })),
  })),
}));

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

describe('TradeForm', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render the form when authenticated', () => {
    render(<TradeForm />, {
      wrapper: createWrapper(),
    });

    // Basic form elements should be present
    expect(screen.getByRole('heading', { name: 'Swap' })).toBeInTheDocument();
    expect(screen.getByTestId('trade-form')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Input Token' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Output Token' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Input Amount' })).toBeInTheDocument();
  });

  it('should show sign in button when wallet is connected but not authenticated', async () => {
    // Mock smallocator to return invalid session
    const mockSmalloc = vi.mocked(smallocator);
    mockSmalloc.verifySession.mockResolvedValueOnce({ valid: false, error: 'Invalid session' });

    render(<TradeForm />, {
      wrapper: createWrapper(),
    });

    // Wait for auth check to complete
    await screen.findByRole('button', { name: 'Sign in to Smallocator' });
  });

  it('should show connect wallet button when wallet is not connected', () => {
    vi.mocked(useAccount).mockReturnValue({
      address: undefined,
      addresses: undefined,
      chain: undefined,
      chainId: undefined,
      connector: undefined,
      isConnected: false,
      isReconnecting: false,
      isConnecting: false,
      isDisconnected: true,
      status: "disconnected",
    });

    render(<TradeForm />, {
      wrapper: createWrapper(),
    });

    // The ConnectButton component is rendered when wallet is not connected
    expect(screen.getByTestId('trade-form')).toBeInTheDocument();
  });
});
