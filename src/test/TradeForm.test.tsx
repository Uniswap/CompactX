// Mock matchMedia for Ant Design
const mediaQueryList = {
  matches: false,
  media: '',
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
};

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation(query => ({
    ...mediaQueryList,
    media: query,
    matches: false,
  })),
});

// Mock ResizeObserver
class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

window.ResizeObserver = ResizeObserver;

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TradeForm } from '../components/TradeForm';
import { useAccount } from 'wagmi';
import type { UseAccountReturnType } from 'wagmi';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { AntWrapper } from './helpers/AntWrapper';

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

vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useChainId: vi.fn().mockReturnValue(1),
  createConfig: () => ({
    chains: [],
    transports: {},
  }),
  WagmiConfig: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../hooks/useCustomTokens', () => ({
  useCustomTokens: vi.fn(() => ({
    customTokens: {},
    addCustomToken: vi.fn(),
    removeCustomToken: vi.fn(),
    getCustomTokens: vi.fn(() => []),
  })),
}));

vi.mock('../hooks/useTokens', () => ({
  useTokens: vi.fn(() => ({
    inputTokens: [
      {
        address: '0x1234',
        symbol: 'TEST',
        decimals: 18,
        chainId: 1,
      },
    ],
    outputTokens: [],
  })),
}));

vi.mock('../hooks/useCalibrator', () => ({
  useCalibrator: vi.fn(() => ({
    useQuote: () => ({
      data: {
        data: {
          arbiter: '0x1234',
          sponsor: '0x5678',
          nonce: '1',
          expires: '1738675211',
          id: '1',
          amount: '1000000000000000000',
          mandate: {
            chainId: 1,
            tribunal: '0x1234',
            recipient: '0x5678',
            expires: '1738675211',
            token: '0x1234',
            minimumAmount: '1000000000000000000',
            baselinePriorityFee: '0',
            scalingFactor: '1000000000100000000',
            salt: '0x1234',
          },
          context: {
            dispensation: '1000000',
            dispensationUSD: '$1.00',
            spotOutputAmount: '1000000000000000000',
            quoteOutputAmountDirect: '1000000000000000000',
            quoteOutputAmountNet: '990000000000000000',
            deltaAmount: '10000000000000000',
            witnessHash: '0x1234',
          },
        },
      },
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: true,
      isIdle: false,
      status: 'success',
      fetchStatus: 'idle',
      refetch: vi.fn(),
    }),
  })),
}));

vi.mock('../hooks/useCompactMessage', () => ({
  useCompactMessage: vi.fn(() => ({
    getMessage: vi.fn(),
  })),
}));

vi.mock('../hooks/useCompactSigner', () => ({
  useCompactSigner: vi.fn(() => ({
    sign: vi.fn(),
  })),
}));

vi.mock('../hooks/useBroadcast', () => ({
  useBroadcast: vi.fn(() => ({
    broadcast: vi.fn(),
  })),
}));

describe('TradeForm', () => {
  beforeEach(() => {
    // Mock useAccount to return an address
    vi.mocked(useAccount).mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      addresses: ['0x1234567890123456789012345678901234567890'],
      chain: 'mainnet',
      chainId: 1,
      connector: {
        id: 'mock',
        name: 'Mock Connector',
        type: 'mock',
        uid: 'mock',
        connect: async () => ({ account: '', chain: 'mainnet' }),
        disconnect: async () => {},
        getAccount: async () => '0x0',
        getChainId: async () => 1,
        getProvider: () => ({}),
        getWalletClient: async () => null,
        isAuthorized: async () => true,
        onAccountsChanged: () => {},
        onChainChanged: () => {},
        onDisconnect: () => {},
        watch: () => () => {},
      },
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      isReconnecting: false,
      status: 'connected',
    } as unknown as UseAccountReturnType);

    // Mock useQuery to return default values
    vi.mocked(useQuery).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: false,
      isIdle: true,
      status: 'idle',
      dataUpdatedAt: Date.now(),
      errorUpdatedAt: Date.now(),
      failureCount: 0,
      failureReason: null,
      fetchStatus: 'idle',
      isRefetching: false,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isInitialLoading: false,
      isPaused: false,
      isStale: false,
      queryKey: ['quote'] as const,
    } as unknown as UseQueryResult);
  });

  it('should render correctly when disconnected', () => {
    render(<TradeForm />, { wrapper: AntWrapper });
    expect(screen.getByTestId('trade-form')).toBeInTheDocument();
  });

  it('should handle input amount changes', async () => {
    render(<TradeForm />, { wrapper: AntWrapper });

    // Open the token select dropdown
    const tokenSelect = screen.getByRole('combobox', { name: 'Input Token' });
    fireEvent.mouseDown(tokenSelect);

    // Wait for the dropdown portal to appear and find the TEST option
    const testOption = await screen.findByTitle('TEST');
    fireEvent.click(testOption);

    // Enter the amount
    const input = screen.getByRole('spinbutton', { name: 'Input Amount' });
    fireEvent.change(input, { target: { value: '1' } });
    expect(input).toHaveValue('1.000000000000000000');
  });

  it('should handle quote loading state', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      isError: false,
      isSuccess: false,
      isIdle: false,
      status: 'loading',
      dataUpdatedAt: Date.now(),
      errorUpdatedAt: Date.now(),
      failureCount: 0,
      failureReason: null,
      fetchStatus: 'fetching',
      isRefetching: false,
      isFetched: false,
      isFetchedAfterMount: false,
      isFetching: true,
      isInitialLoading: true,
      isPaused: false,
      isStale: false,
      queryKey: ['quote'] as const,
    } as unknown as UseQueryResult);

    render(<TradeForm />, { wrapper: AntWrapper });
  });

  it('should handle quote error state', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Test error'),
      isError: true,
      isSuccess: false,
      isIdle: false,
      status: 'error',
      dataUpdatedAt: Date.now(),
      errorUpdatedAt: Date.now(),
      failureCount: 1,
      failureReason: 'Test error',
      fetchStatus: 'idle',
      isRefetching: false,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isInitialLoading: false,
      isPaused: false,
      isStale: false,
      queryKey: ['quote'] as const,
    } as unknown as UseQueryResult);

    render(<TradeForm />, { wrapper: AntWrapper });
  });
});
