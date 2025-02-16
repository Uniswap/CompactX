import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLockedTokenBalances } from '../hooks/useLockedTokenBalances';
import { useAccount } from 'wagmi';
import { TestWrapper } from './test-wrapper';
import { useLockedBalances } from '../api/graphql';
import type { UseAccountReturnType } from 'wagmi';
import type { UseQueryResult } from '@tanstack/react-query';

// Define types for GraphQL response
interface ResourceLock {
  name: string;
  symbol: string;
  decimals: number;
  lockId: string;
  allocator: {
    account: string;
  };
  resetPeriod: number;
  isMultichain: boolean;
  totalSupply: string;
}

interface ResourceLockBalance {
  resourceLock: ResourceLock;
  withdrawableAt: string;
  withdrawalStatus: string;
  balance: string;
}

interface Token {
  name: string;
  symbol: string;
  decimals: number;
  chainId: number;
  tokenAddress: string;
  totalSupply: string;
}

interface TokenBalance {
  token: Token;
  aggregateBalance: string;
  resourceLocks: {
    items: ResourceLockBalance[];
    pageInfo: {
      startCursor: string | null;
      endCursor: string | null;
      hasPreviousPage: boolean;
      hasNextPage: boolean;
    };
    totalCount: number;
  };
}

interface GraphQLResponse {
  account: {
    depositor: string;
    tokenBalances: {
      items: TokenBalance[];
      pageInfo: {
        startCursor: string | null;
        endCursor: string | null;
        hasPreviousPage: boolean;
        hasNextPage: boolean;
      };
      totalCount: number;
    };
  };
}

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn().mockReturnValue({
    address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
    isConnected: true,
  }),
  useSignMessage: vi.fn().mockReturnValue({
    signMessageAsync: vi.fn().mockResolvedValue('0xmocksignature'),
    isLoading: false,
    error: null,
  }),
  createConfig: () => ({
    chains: [],
    transports: {},
  }),
  WagmiConfig: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock graphql hook
vi.mock('../api/graphql', () => ({
  useLockedBalances: vi.fn(),
}));

describe('useLockedTokenBalances', () => {
  it('returns empty balances when no account is connected', () => {
    // Mock useAccount to return no address
    vi.mocked(useAccount).mockReturnValue({
      address: undefined,
      addresses: undefined,
      chain: undefined,
      chainId: undefined,
      connector: undefined,
      isConnected: false,
      isConnecting: false,
      isDisconnected: true,
      isReconnecting: false,
      status: 'disconnected',
    } as unknown as UseAccountReturnType);

    // Mock useLockedBalances to return no data
    vi.mocked(useLockedBalances).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as UseQueryResult<GraphQLResponse>);

    const { result } = renderHook(() => useLockedTokenBalances(), {
      wrapper: TestWrapper,
    });

    expect(result.current.balances).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('returns aggregated balances when account is connected', () => {
    const mockAddress = '0x1234567890123456789012345678901234567890';
    const now = Date.now();
    const pastTimestamp = Math.floor((now - 3600000) / 1000); // 1 hour ago in seconds
    const futureTimestamp = Math.floor((now + 3600000) / 1000); // 1 hour from now in seconds

    // Mock useAccount to return an address
    vi.mocked(useAccount).mockReturnValue({
      address: mockAddress as `0x${string}`,
      addresses: [mockAddress as `0x${string}`],
      chain: {
        id: 1,
        name: 'Ethereum',
        network: 'mainnet',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: [''] }, public: { http: [''] } },
      },
      chainId: 1,
      connector: undefined,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      isReconnecting: false,
      status: 'connected',
    } as unknown as UseAccountReturnType);

    // Mock useLockedBalances to return some data
    vi.mocked(useLockedBalances).mockReturnValue({
      data: {
        account: {
          depositor: mockAddress,
          tokenBalances: {
            items: [
              {
                token: {
                  name: 'Test Token',
                  symbol: 'TEST',
                  decimals: 18,
                  chainId: 1,
                  tokenAddress: '0x2222222222222222222222222222222222222222',
                  totalSupply: '1000000000000000000000',
                },
                aggregateBalance: '100000000000000000000',
                resourceLocks: {
                  items: [
                    {
                      resourceLock: {
                        name: 'Locked TEST',
                        symbol: 'lTEST',
                        decimals: 18,
                        lockId: '1',
                        allocator: {
                          account: '0x3333333333333333333333333333333333333333',
                        },
                        resetPeriod: 86400,
                        isMultichain: true,
                        totalSupply: '500000000000000000000',
                      },
                      withdrawableAt: futureTimestamp.toString(),
                      withdrawalStatus: '0',
                      balance: '50000000000000000000',
                    },
                    {
                      resourceLock: {
                        name: 'Unlocked TEST',
                        symbol: 'ulTEST',
                        decimals: 18,
                        lockId: '2',
                        allocator: {
                          account: '0x4444444444444444444444444444444444444444',
                        },
                        resetPeriod: 86400,
                        isMultichain: false,
                        totalSupply: '500000000000000000000',
                      },
                      withdrawableAt: pastTimestamp.toString(),
                      withdrawalStatus: '0',
                      balance: '50000000000000000000',
                    },
                  ],
                  pageInfo: {
                    startCursor: null,
                    endCursor: null,
                    hasPreviousPage: false,
                    hasNextPage: false,
                  },
                  totalCount: 2,
                },
              },
            ],
            pageInfo: {
              startCursor: null,
              endCursor: null,
              hasPreviousPage: false,
              hasNextPage: false,
            },
            totalCount: 1,
          },
        },
      },
      isLoading: false,
      error: null,
    } as UseQueryResult<GraphQLResponse>);

    const { result } = renderHook(() => useLockedTokenBalances(), {
      wrapper: TestWrapper,
    });

    expect(result.current.balances).toHaveLength(1);
    expect(result.current.balances[0]).toMatchObject({
      tokenAddress: '0x2222222222222222222222222222222222222222',
      isNative: false,
      name: 'Test Token',
      symbol: 'TEST',
      decimals: 18,
      totalBalance: '100000000000000000000',
    });

    // Check chain balances
    expect(result.current.balances[0].chainBalances).toHaveLength(1);
    expect(result.current.balances[0].chainBalances[0]).toMatchObject({
      chainId: '1',
      balance: '100000000000000000000',
    });

    // Check resource locks
    const resourceLocks = result.current.balances[0].chainBalances[0].resourceLocks;
    expect(resourceLocks).toHaveLength(2);

    // Check locked token
    expect(resourceLocks[0]).toMatchObject({
      name: 'Locked TEST',
      symbol: 'lTEST',
      isLocked: true,
      balance: '50000000000000000000',
    });

    // Check unlocked token
    expect(resourceLocks[1]).toMatchObject({
      name: 'Unlocked TEST',
      symbol: 'ulTEST',
      isLocked: false,
      balance: '50000000000000000000',
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });
});
