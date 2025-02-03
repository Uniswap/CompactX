import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCalibrator } from '../hooks/useCalibrator';
import { useAccount } from 'wagmi';
import type { UseAccountReturnType, Config } from 'wagmi';
import { TestWrapper } from './test-wrapper';
import type { MockInstance } from 'vitest';

vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  createConfig: () => ({
    chains: [],
    transports: {},
  }),
  WagmiConfig: ({ children }: { children: React.ReactNode }) => children,
}));

const mockFetch: MockInstance = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('useCalibrator', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890';
  const mockNow = new Date('2024-01-01').getTime();
  const expectedExpires = Math.floor(mockNow / 1000 + 300).toString();
  const mockQuoteResponse = {
    data: {
      arbiter: '0xf4eA570740Ce552632F19c8E92691c6A5F6374D9',
      sponsor: mockAddress,
      nonce: null,
      expires: expectedExpires,
      id: '58410676126309294830333372681472538366911531218326345030263838841923761602566',
      amount: '1000000000000000000',
      mandate: {
        chainId: 8453,
        tribunal: '0x339B234fdBa8C5C77c43AA01a6ad38071B7984F1',
        recipient: mockAddress,
        expires: expectedExpires,
        token: '0x4200000000000000000000000000000000000006',
        minimumAmount: '989904904981520408',
        baselinePriorityFee: '1000000000',
        scalingFactor: '1000000000100000000',
        salt: '0xd819b8a009b11c1656ea2c0e6163878f0b6369b62d366b6dd2ba967cab7b742f',
      },
    },
    context: {
      dispensation: '96055574221810',
      dispensationUSD: '$0.2639',
      spotOutputAmount: '1003305249041587222',
      quoteOutputAmountDirect: '1000000000000000000',
      quoteOutputAmountNet: '999903944425778190',
      deltaAmount: '-3401304615809032',
      witnessHash: '0x16773896e7807b7c9a89c08ea9536c2ace289cc7adb56a2ccd973f87f1f973fd',
    },
  };

  const mockedUseAccount = vi.mocked(useAccount);

  beforeEach(() => {
    mockFetch.mockClear();
    mockedUseAccount.mockClear();
    // Mock useAccount hook
    mockedUseAccount.mockReturnValue({
      address: mockAddress as `0x${string}`,
      addresses: [mockAddress as `0x${string}`],
      chain: undefined,
      chainId: 1,
      connector: undefined,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      isReconnecting: false,
      status: 'connected',
    } as unknown as UseAccountReturnType<Config>);

    // Mock Date.now() to ensure consistent expires timestamp
    vi.spyOn(Date, 'now').mockImplementation(() => mockNow);

    // Mock fetch
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockQuoteResponse,
    });
  });

  afterEach(() => {
    mockedUseAccount.mockClear();
    vi.restoreAllMocks();
  });

  it('should return quote data when parameters are provided', async () => {
    const quoteParams = {
      inputTokenChainId: 10,
      inputTokenAddress: '0x4200000000000000000000000000000000000006',
      inputTokenAmount: '1000000000000000000',
      outputTokenChainId: 8453,
      outputTokenAddress: '0x4200000000000000000000000000000000000006',
      slippageBips: 100,
    };

    const { result } = renderHook(() => useCalibrator(), {
      wrapper: TestWrapper,
    });

    const quote = await result.current.getQuote(quoteParams);

    expect(quote).toEqual(mockQuoteResponse);
    expect(mockFetch).toHaveBeenCalledWith(`${process.env.VITE_CALIBRATOR_API_URL}/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sponsor: mockAddress,
        inputTokenChainId: 10,
        inputTokenAddress: '0x4200000000000000000000000000000000000006',
        inputTokenAmount: '1000000000000000000',
        outputTokenChainId: 8453,
        outputTokenAddress: '0x4200000000000000000000000000000000000006',
        lockParameters: {
          allocatorId: '0',
          resetPeriod: 0,
          isMultichain: false,
        },
        context: {
          slippageBips: 100,
          recipient: mockAddress,
          baselinePriorityFee: '0',
          scalingFactor: '0',
          expires: expectedExpires,
        },
      }),
    });
  });

  it('should throw error when wallet is not connected', async () => {
    mockedUseAccount.mockReturnValue({
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
    } as unknown as UseAccountReturnType<Config>);

    const quoteParams = {
      inputTokenChainId: 10,
      inputTokenAddress: '0x4200000000000000000000000000000000000006',
      inputTokenAmount: '1000000000000000000',
      outputTokenChainId: 8453,
      outputTokenAddress: '0x4200000000000000000000000000000000000006',
      slippageBips: 100,
    };

    const { result } = renderHook(() => useCalibrator(), {
      wrapper: TestWrapper,
    });

    await expect(result.current.getQuote(quoteParams)).rejects.toThrow('Wallet not connected');
  });

  it('should throw error when API request fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
    } as Response);

    const quoteParams = {
      inputTokenChainId: 10,
      inputTokenAddress: '0x4200000000000000000000000000000000000006',
      inputTokenAmount: '1000000000000000000',
      outputTokenChainId: 8453,
      outputTokenAddress: '0x4200000000000000000000000000000000000006',
      slippageBips: 100,
    };

    const { result } = renderHook(() => useCalibrator(), {
      wrapper: TestWrapper,
    });

    await expect(result.current.getQuote(quoteParams)).rejects.toThrow('Failed to fetch quote');
  });

  it('should use query hook correctly', async () => {
    const quoteParams = {
      inputTokenChainId: 10,
      inputTokenAddress: '0x4200000000000000000000000000000000000006',
      inputTokenAmount: '1000000000000000000',
      outputTokenChainId: 8453,
      outputTokenAddress: '0x4200000000000000000000000000000006',
      slippageBips: 100,
    };

    const { result } = renderHook(() => useCalibrator().useQuote(quoteParams), {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockQuoteResponse);
    });
  });

  it('should fetch quote successfully', async () => {
    // Mock useAccount
    mockedUseAccount.mockReturnValue({
      address: mockAddress as `0x${string}`,
      addresses: [mockAddress as `0x${string}`],
      chain: undefined,
      chainId: 1,
      connector: undefined,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      isReconnecting: false,
      status: 'connected',
    } as unknown as UseAccountReturnType<Config>);

    // Mock fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            arbiter: mockAddress,
            sponsor: mockAddress,
            nonce: null,
            expires: '1234567890',
            id: '1234567890',
            amount: '1000000000000000000',
            mandate: {
              chainId: 1,
              tribunal: mockAddress,
              recipient: mockAddress,
              expires: '1234567890',
              token: mockAddress,
              minimumAmount: '1000000000000000000',
              baselinePriorityFee: '1000000000000000000',
              scalingFactor: '1000000000000000000',
              salt: '1234567890',
            },
            context: {
              dispensation: '2639000000000000',
              dispensationUSD: '$0.2639',
              spotOutputAmount: '1000000000000000000',
              quoteOutputAmountDirect: '1000000000000000000',
              quoteOutputAmountNet: '1000000000000000000',
              deltaAmount: '0',
              witnessHash: mockAddress,
            },
          },
        }),
    } as Response);

    const { result } = renderHook(() => useCalibrator(), {
      wrapper: TestWrapper,
    });

    const quoteParams = {
      inputTokenChainId: 1,
      inputTokenAddress: mockAddress,
      inputTokenAmount: '1000000000000000000',
      outputTokenChainId: 1,
      outputTokenAddress: mockAddress,
      slippageBips: 50,
    };

    const quote = await result.current.getQuote(quoteParams);
    expect(quote.data.mandate.minimumAmount).toBe('1000000000000000000');
    expect(quote.data.context.dispensationUSD).toBe('$0.2639');
  });

  it('should handle fetch error', async () => {
    // Mock useAccount
    mockedUseAccount.mockReturnValue({
      address: mockAddress as `0x${string}`,
      addresses: [mockAddress as `0x${string}`],
      chain: undefined,
      chainId: 1,
      connector: undefined,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      isReconnecting: false,
      status: 'connected',
    } as unknown as UseAccountReturnType<Config>);

    // Mock fetch error
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () =>
        Promise.resolve({
          error: 'Invalid request parameters',
        }),
    } as Response);

    const { result } = renderHook(() => useCalibrator(), {
      wrapper: TestWrapper,
    });

    const quoteParams = {
      inputTokenChainId: 1,
      inputTokenAddress: mockAddress,
      inputTokenAmount: '1000000000000000000',
      outputTokenChainId: 1,
      outputTokenAddress: mockAddress,
      slippageBips: 50,
    };

    await expect(result.current.getQuote(quoteParams)).rejects.toThrow('Failed to fetch quote');
  });

  it('should throw error when wallet is not connected', async () => {
    // Mock useAccount to return no address
    mockedUseAccount.mockReturnValue({
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
    } as unknown as UseAccountReturnType<Config>);

    const { result } = renderHook(() => useCalibrator(), {
      wrapper: TestWrapper,
    });

    const quoteParams = {
      inputTokenChainId: 1,
      inputTokenAddress: mockAddress,
      inputTokenAmount: '1000000000000000000',
      outputTokenChainId: 1,
      outputTokenAddress: mockAddress,
      slippageBips: 50,
    };

    await expect(result.current.getQuote(quoteParams)).rejects.toThrow('Wallet not connected');
  });
});
