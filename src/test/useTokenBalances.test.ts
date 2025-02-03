import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTokenBalances } from '../hooks/useTokenBalances';
import { useAccount, useBalance } from 'wagmi';
import type { UseAccountReturnType, UseBalanceReturnType } from 'wagmi';
import { vi } from 'vitest';
import { TestWrapper } from './test-wrapper';
import { mainnet } from 'wagmi/chains';

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useBalance: vi.fn(),
  createConfig: () => ({
    chains: [],
    transports: {},
  }),
  WagmiConfig: ({ children }: { children: React.ReactNode }) => children,
}));

describe('useTokenBalances', () => {
  it('returns empty balances when no account is connected', () => {
    // Mock useAccount to return no address
    vi.mocked(useAccount).mockReturnValue({
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
    } as unknown as UseAccountReturnType);

    // Mock useBalance to return no balance
    vi.mocked(useBalance).mockReturnValue({
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
    } as unknown as UseBalanceReturnType);

    const { result } = renderHook(() => useTokenBalances(), {
      wrapper: TestWrapper,
    });

    expect(result.current.balances).toEqual({});
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('returns native balance when account is connected', () => {
    // Mock useAccount to return an address
    vi.mocked(useAccount).mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      addresses: ['0x1234567890123456789012345678901234567890'],
      chain: mainnet,
      chainId: 1,
      connector: {
        id: 'mock',
        name: 'Mock Connector',
        type: 'mock',
        uid: 'mock',
        connect: async () => ({ account: '', chain: mainnet }),
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

    // Mock useBalance to return a balance
    vi.mocked(useBalance).mockReturnValue({
      data: {
        value: 1000000000000000000n,
        decimals: 18,
        formatted: '1.0',
        symbol: 'ETH',
      },
      error: null,
      isError: false,
      isPending: false,
      isLoadingError: false,
      isRefetchError: false,
      isSuccess: true,
      isLoading: false,
      isPlaceholderData: false,
      status: 'success',
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
    } as unknown as UseBalanceReturnType);

    const { result } = renderHook(() => useTokenBalances(), {
      wrapper: TestWrapper,
    });

    expect(result.current.balances).toEqual({
      native: 1000000000000000000n,
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });
});
