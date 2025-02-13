import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCalibrator } from '../hooks/useCalibrator';
import { useAccount } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TestWrapper } from './test-wrapper';
import type { MockInstance } from 'vitest';

const mockUseTokens = vi.fn();
vi.mock('../hooks/useTokens', () => ({
  useTokens: () => mockUseTokens(),
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

const mockFetch: MockInstance = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TestWrapper>{children}</TestWrapper>
    </QueryClientProvider>
  );

  return Wrapper;
};

describe('useCalibrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VITE_CALIBRATOR_API_URL = 'https://calibrat0r.com';
    mockUseTokens.mockReturnValue({
      inputTokens: [
        {
          address: '0x4200000000000000000000000000000000000006',
          symbol: 'TEST',
          decimals: 18,
          chainId: 10,
        },
      ],
      outputTokens: [
        {
          address: '0x4200000000000000000000000000000000000006',
          symbol: 'TEST',
          decimals: 18,
          chainId: 8453,
        },
      ],
    });

    (vi.mocked(useAccount) as unknown as MockInstance).mockReturnValue({
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      addresses: ['0x1234567890123456789012345678901234567890'] as readonly `0x${string}`[],
      chain: undefined,
      chainId: 1,
      connector: undefined,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      isReconnecting: false,
      status: 'connected',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.VITE_CALIBRATOR_API_URL;
  });

  it('should return quote data with default expiry values when not provided', async () => {
    const mockResponse = {
      data: {
        amount: '1000000000000000000',
        arbiter: '0xf4eA570740Ce552632F19c8E92691c6A5F6374D9',
        fillExpires: '1704067500',
        claimExpires: '1704067800',
        id: '58410676126309294830333372681472538366911531218326345030263838841923761602566',
        mandate: {
          baselinePriorityFee: '1000000000',
          chainId: 8453,
          fillExpires: '1704067500',
          claimExpires: '1704067800',
          minimumAmount: '989904904981520408',
          recipient: '0x1234567890123456789012345678901234567890',
          salt: '0xd819b8a009b11c1656ea2c0e6163878f0b6369b62d366b6dd2ba967cab7b742f',
          scalingFactor: '1000000000100000000',
          token: '0x4200000000000000000000000000000000000006',
          tribunal: '0x339B234fdBa8C5C77c43AA01a6ad38071B7984F1',
        },
        nonce: null,
        sponsor: '0x1234567890123456789012345678901234567890',
      },
      context: {
        deltaAmount: '-3401304615809032',
        dispensation: '96055574221810',
        dispensationUSD: '$0.2639',
        quoteOutputAmountDirect: '1000000000000000000',
        quoteOutputAmountNet: '999903944425778190',
        spotOutputAmount: '1003305249041587222',
        witnessHash: '0x16773896e7807b7c9a89c08ea9536c2ace289cc7adb56a2ccd973f87f1f973fd',
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const quoteParams = {
      inputTokenChainId: 10,
      inputTokenAddress: '0x4200000000000000000000000000000000000006',
      inputTokenAmount: '1000000000000000000', // Already scaled by decimals
      outputTokenChainId: 8453,
      outputTokenAddress: '0x4200000000000000000000000000000000000006',
      slippageBips: 100,
    };

    const { result } = renderHook(() => useCalibrator().useQuote(quoteParams), {
      wrapper: createWrapper(),
    });

    // Wait for the fetch to be called
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Verify the fetch call
    expect(mockFetch).toHaveBeenCalledWith('https://calibrat0r.com/quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: expect.any(String),
    });

    // Parse and verify the request body
    const requestBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);

    // Verify the structure
    expect(requestBody).toMatchObject({
      sponsor: '0x1234567890123456789012345678901234567890',
      inputTokenChainId: 10,
      inputTokenAddress: '0x4200000000000000000000000000000000000006',
      inputTokenAmount: '1000000000000000000', // 1 token with 18 decimals
      outputTokenChainId: 8453,
      outputTokenAddress: '0x4200000000000000000000000000000000000006',
      lockParameters: {
        allocatorId: '0',
        resetPeriod: 0,
        isMultichain: false,
      },
      context: {
        slippageBips: 100,
        recipient: '0x1234567890123456789012345678901234567890',
        baselinePriorityFee: '0',
        scalingFactor: '1000000000100000000',
        fillExpires: expect.any(String),
        claimExpires: expect.any(String),
      },
    });

    // Wait for the data to be available
    await waitFor(() => {
      expect(result.current.data).toEqual(mockResponse);
    });

    // Verify default expiry values were set (within a reasonable range)
    const now = Math.floor(Date.now() / 1000);
    expect(parseInt(requestBody.context.fillExpires)).toBeGreaterThan(now + 170); // ~3 minutes from now
    expect(parseInt(requestBody.context.fillExpires)).toBeLessThan(now + 190);
    expect(parseInt(requestBody.context.claimExpires)).toBeGreaterThan(now + 530); // ~9 minutes from now
    expect(parseInt(requestBody.context.claimExpires)).toBeLessThan(now + 550);
  });

  it('should use provided fillExpires and claimExpires values', async () => {
    const mockResponse = {
      data: {
        amount: '1000000000000000000',
        arbiter: '0xf4eA570740Ce552632F19c8E92691c6A5F6374D9',
        fillExpires: '1704067500',
        claimExpires: '1704067800',
        id: '58410676126309294830333372681472538366911531218326345030263838841923761602566',
        mandate: {
          baselinePriorityFee: '1000000000',
          chainId: 8453,
          fillExpires: '1704067500',
          claimExpires: '1704067800',
          minimumAmount: '989904904981520408',
          recipient: '0x1234567890123456789012345678901234567890',
          salt: '0xd819b8a009b11c1656ea2c0e6163878f0b6369b62d366b6dd2ba967cab7b742f',
          scalingFactor: '1000000000100000000',
          token: '0x4200000000000000000000000000000000000006',
          tribunal: '0x339B234fdBa8C5C77c43AA01a6ad38071B7984F1',
        },
        nonce: null,
        sponsor: '0x1234567890123456789012345678901234567890',
      },
      context: {
        deltaAmount: '-3401304615809032',
        dispensation: '96055574221810',
        dispensationUSD: '$0.2639',
        quoteOutputAmountDirect: '1000000000000000000',
        quoteOutputAmountNet: '999903944425778190',
        spotOutputAmount: '1003305249041587222',
        witnessHash: '0x16773896e7807b7c9a89c08ea9536c2ace289cc7adb56a2ccd973f87f1f973fd',
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const customFillExpires = '1704067500';
    const customClaimExpires = '1704067800';

    const quoteParams = {
      inputTokenChainId: 10,
      inputTokenAddress: '0x4200000000000000000000000000000000000006',
      inputTokenAmount: '1000000000000000000',
      outputTokenChainId: 8453,
      outputTokenAddress: '0x4200000000000000000000000000000000000006',
      slippageBips: 100,
      fillExpires: customFillExpires,
      claimExpires: customClaimExpires,
    };

    const { result } = renderHook(() => useCalibrator().useQuote(quoteParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const requestBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(requestBody.context.fillExpires).toBe(customFillExpires);
    expect(requestBody.context.claimExpires).toBe(customClaimExpires);

    await waitFor(() => {
      expect(result.current.data).toEqual(mockResponse);
    });
  });

  it('should handle fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Failed to fetch quote'));

    const quoteParams = {
      inputTokenChainId: 10,
      inputTokenAddress: '0x4200000000000000000000000000000000000006',
      inputTokenAmount: '1',
      outputTokenChainId: 8453,
      outputTokenAddress: '0x4200000000000000000000000000000000000006',
      slippageBips: 100,
    };

    const { result } = renderHook(() => useCalibrator().useQuote(quoteParams), {
      wrapper: createWrapper(),
    });

    // Wait for the error to be available
    await waitFor(() => {
      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Failed to fetch quote');
    });
  });

  it('should handle wallet not connected error', async () => {
    (vi.mocked(useAccount) as unknown as MockInstance).mockReturnValue({
      address: undefined,
      addresses: [] as readonly `0x${string}`[],
      chain: undefined,
      chainId: undefined,
      connector: undefined,
      isConnected: false,
      isConnecting: false,
      isDisconnected: true,
      isReconnecting: false,
      status: 'disconnected',
    });

    const quoteParams = {
      inputTokenChainId: 10,
      inputTokenAddress: '0x4200000000000000000000000000000000000006',
      inputTokenAmount: '1',
      outputTokenChainId: 8453,
      outputTokenAddress: '0x4200000000000000000000000000000000000006',
      slippageBips: 100,
    };

    const { result } = renderHook(() => useCalibrator().getQuote(quoteParams), {
      wrapper: createWrapper(),
    });

    // Since we're calling getQuote directly, we expect it to throw
    await expect(result.current).rejects.toThrow('Wallet not connected');
  });
});
