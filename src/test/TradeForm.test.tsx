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

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { TradeForm } from '../components/TradeForm';
import { AntWrapper } from './helpers/AntWrapper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock wagmi
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
      <AntWrapper>{children}</AntWrapper>
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
  beforeEach(() => {
    // Create portal container for Ant Design dropdowns
    const portalRoot = document.createElement('div');
    portalRoot.setAttribute('id', 'ant-select-dropdown');
    document.body.appendChild(portalRoot);
  });

  afterEach(() => {
    // Clean up portal container
    const portalRoot = document.getElementById('ant-select-dropdown');
    if (portalRoot) {
      document.body.removeChild(portalRoot);
    }
    vi.clearAllMocks();
  });

  it('should render the form', () => {
    render(<TradeForm />, {
      wrapper: createWrapper(),
    });

    // Basic form elements should be present
    expect(screen.getByRole('heading', { name: 'Swap' })).toBeInTheDocument();
    expect(screen.getByTestId('trade-form')).toBeInTheDocument();
    expect(screen.getByTestId('input-token-select')).toBeInTheDocument();
    expect(screen.getByTestId('output-token-select')).toBeInTheDocument();
    expect(screen.getByLabelText('Input Amount')).toBeInTheDocument();
  });
});
