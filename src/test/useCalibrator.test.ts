import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCalibrator } from '../hooks/useCalibrator'
import { useAccount } from 'wagmi'
import { TestWrapper } from './test-wrapper'

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  createConfig: () => ({
    chains: [],
    transports: {},
  }),
  WagmiConfig: ({ children }: { children: React.ReactNode }) => children,
}))

describe('useCalibrator', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890'
  const mockNow = new Date('2024-01-01').getTime()
  const expectedExpires = Math.floor(mockNow / 1000 + 86400).toString()
  let mockQuoteResponse = {
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
      witnessHash:
        '0x16773896e7807b7c9a89c08ea9536c2ace289cc7adb56a2ccd973f87f1f973fd',
    },
  }

  beforeEach(() => {
    // Mock useAccount hook
    (useAccount as jest.Mock).mockReturnValue({
      address: mockAddress,
    })

    // Mock Date.now() to ensure consistent expires timestamp
    vi.spyOn(Date, 'now').mockImplementation(() => mockNow)

    // Mock fetch
    global.fetch = vi.fn()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockQuoteResponse,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should return quote data when parameters are provided', async () => {
    const quoteParams = {
      inputTokenChainId: 10,
      inputTokenAddress: '0x4200000000000000000000000000000000000006',
      inputTokenAmount: '1000000000000000000',
      outputTokenChainId: 8453,
      outputTokenAddress: '0x4200000000000000000000000000000000000006',
      slippageBips: 100,
    }

    const { result } = renderHook(() => useCalibrator(), {
      wrapper: TestWrapper,
    })

    const quote = await result.current.getQuote(quoteParams)

    expect(quote).toEqual(mockQuoteResponse)
    expect(global.fetch).toHaveBeenCalledWith(
      `${process.env.VITE_CALIBRATOR_API_URL}/quote`,
      {
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
            allocatorId: '0x000000000000000000000000',
            resetPeriod: 0,
            isMultichain: false,
          },
          context: {
            slippageBips: 100,
            recipient: mockAddress,
            baselinePriorityFee: '1000000000',
            scalingFactor: '1000000000100000000',
            expires: expectedExpires,
          },
        }),
      },
    )
  })

  it('should throw error when wallet is not connected', async () => {
    (useAccount as jest.Mock).mockReturnValue({
      address: undefined,
    })

    const quoteParams = {
      inputTokenChainId: 10,
      inputTokenAddress: '0x4200000000000000000000000000000000000006',
      inputTokenAmount: '1000000000000000000',
      outputTokenChainId: 8453,
      outputTokenAddress: '0x4200000000000000000000000000000000000006',
      slippageBips: 100,
    }

    const { result } = renderHook(() => useCalibrator(), {
      wrapper: TestWrapper,
    })

    await expect(result.current.getQuote(quoteParams)).rejects.toThrow(
      'Wallet not connected'
    )
  })

  it('should throw error when API request fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
    } as Response)

    const quoteParams = {
      inputTokenChainId: 10,
      inputTokenAddress: '0x4200000000000000000000000000000000000006',
      inputTokenAmount: '1000000000000000000',
      outputTokenChainId: 8453,
      outputTokenAddress: '0x4200000000000000000000000000000000000006',
      slippageBips: 100,
    }

    const { result } = renderHook(() => useCalibrator(), {
      wrapper: TestWrapper,
    })

    await expect(result.current.getQuote(quoteParams)).rejects.toThrow(
      'Failed to fetch quote'
    )
  })

  it('should use query hook correctly', async () => {
    const quoteParams = {
      inputTokenChainId: 10,
      inputTokenAddress: '0x4200000000000000000000000000000000000006',
      inputTokenAmount: '1000000000000000000',
      outputTokenChainId: 8453,
      outputTokenAddress: '0x4200000000000000000000000000000006',
      slippageBips: 100,
    }

    const { result } = renderHook(() => useCalibrator().useQuote(quoteParams), {
      wrapper: TestWrapper,
    })

    await waitFor(() => {
      expect(result.current.data).toEqual(mockQuoteResponse)
    })
  })
})
