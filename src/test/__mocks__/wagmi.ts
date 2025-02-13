import { vi } from 'vitest';
import { mainnet } from 'wagmi/chains';

export const useSignMessage = vi.fn().mockReturnValue({
  data: undefined,
  error: null,
  isError: false,
  isIdle: true,
  isLoading: false,
  isSuccess: false,
  signMessage: vi.fn(),
  signMessageAsync: vi.fn().mockResolvedValue('0xsignature'),
  reset: vi.fn(),
  variables: undefined,
});

export const useAccount = vi.fn().mockReturnValue({
  address: undefined,
  addresses: [],
  chain: undefined,
  chainId: undefined,
  connector: undefined,
  isConnected: false,
  isConnecting: false,
  isDisconnected: true,
  isReconnecting: false,
  status: 'disconnected',
});
export const useBalance = vi.fn().mockReturnValue({
  data: undefined,
  error: null,
  isError: false,
  isPending: false,
  isLoadingError: false,
  isRefetchError: false,
  isSuccess: false,
  isLoading: false,
  isPlaceholderData: false,
  status: 'error',
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
  queryKey: ['balance'] as const,
});
export const WagmiConfig = ({ children }: { children: React.ReactNode }) => children;
export const createConfig = vi.fn().mockReturnValue({
  chains: [],
  transports: {},
});

export const http = vi.fn().mockReturnValue({
  request: vi.fn(),
});

// Re-export mainnet for use in tests
export { mainnet };
