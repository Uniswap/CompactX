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

// Mock wagmi
vi.mock('wagmi', () => ({
  createConfig: () => ({
    state: {
      chainId: 1,
      chains: [],
      transport: {},
    },
  }),
  WagmiConfig: ({ children }: { children: React.ReactNode }) => children,
  useAccount: vi.fn().mockReturnValue({
    address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
    isConnected: true,
  }),
  useNetwork: () => ({
    chain: { id: 1, name: 'Mainnet' },
  }),
  useChainId: () => 1,
  http: () => ({
    request: vi.fn(),
  }),
  useSignMessage: vi.fn().mockReturnValue({
    signMessageAsync: vi.fn().mockResolvedValue('0xmocksignature'),
    isLoading: false,
    error: null,
  }),
  useContractRead: vi.fn().mockReturnValue({
    data: BigInt(0),
    isError: false,
  }),
}));

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
      <TestWrapper>{children}</TestWrapper>
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

describe('TradeForm', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render the form', () => {
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
});
