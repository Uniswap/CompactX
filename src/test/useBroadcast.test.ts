import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBroadcast } from '../hooks/useBroadcast';
import { message } from 'antd';
import { broadcast } from '../api/broadcast';

vi.mock('antd', () => ({
  message: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../api/broadcast', () => ({
  broadcast: {
    broadcast: vi.fn(),
  },
}));

const mockPayload = {
  chainId: '1',
  compact: {
    arbiter: '0x1234567890123456789012345678901234567890',
    sponsor: '0x2234567890123456789012345678901234567890',
    nonce: null,
    expires: '1732520000',
    id: '0x3234567890123456789012345678901234567890',
    amount: '1000000000000000000',
    mandate: {
      chainId: 1,
      tribunal: '0x1234567890123456789012345678901234567890',
      recipient: '0x4234567890123456789012345678901234567890',
      expires: '1732520000',
      token: '0x5234567890123456789012345678901234567890',
      minimumAmount: '1000000000000000000',
      baselinePriorityFee: '1000000000',
      scalingFactor: '1000000000000000000',
      salt: ('0x' + '00'.repeat(32)) as `0x${string}`,
    },
  },
};

const mockUserSignature = ('0x' + '00'.repeat(65)) as `0x${string}`;
const mockSmallocatorSignature = ('0x' + '00'.repeat(65)) as `0x${string}`;

const mockContext = {
  dispensation: '1000000000',
  dispensationUSD: '1.00',
  spotOutputAmount: '1000000000000000000',
  quoteOutputAmountDirect: '990000000000000000',
  quoteOutputAmountNet: '980000000000000000',
  allocatorId: '1',
  resetPeriod: 0,
  isMultichain: true,
  slippageBips: 100,
  witnessTypeString:
    'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
  witnessHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
};

describe('useBroadcast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should broadcast successfully', async () => {
    vi.mocked(broadcast.broadcast).mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useBroadcast());

    await act(async () => {
      const response = await result.current.broadcast(
        mockPayload,
        mockUserSignature,
        mockSmallocatorSignature,
        mockContext
      );
      expect(response).toEqual({ success: true });
    });

    expect(broadcast.broadcast).toHaveBeenCalledWith({
      finalPayload: {
        chainId: mockPayload.chainId,
        compact: {
          ...mockPayload.compact,
          mandate: {
            ...mockPayload.compact.mandate,
            chainId: Number(mockPayload.chainId),
            tribunal: mockPayload.compact.mandate.tribunal,
          },
        },
        sponsorSignature: mockUserSignature,
        allocatorSignature: mockSmallocatorSignature,
        context: mockContext,
      },
    });

    expect(result.current.error).toBeNull();
    expect(message.success).toHaveBeenCalledWith('Transaction broadcast successfully');
  });

  it('should handle broadcast error', async () => {
    const error = new Error('Network error');
    vi.mocked(broadcast.broadcast).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useBroadcast());

    await act(async () => {
      try {
        await result.current.broadcast(
          mockPayload,
          mockUserSignature,
          mockSmallocatorSignature,
          mockContext
        );
      } catch (e) {
        expect(e).toBe(error);
      }
    });

    expect(result.current.error).toBe(error);
    expect(message.error).toHaveBeenCalledWith('Network error');
  });

  it('should handle broadcast failure', async () => {
    vi.mocked(broadcast.broadcast).mockResolvedValueOnce({ success: false });

    const { result } = renderHook(() => useBroadcast());

    await act(async () => {
      try {
        await result.current.broadcast(
          mockPayload,
          mockUserSignature,
          mockSmallocatorSignature,
          mockContext
        );
      } catch (e) {
        if (e instanceof Error) {
          expect(e.message).toBe('Failed to broadcast transaction');
        } else {
          throw new Error('Expected error to be instance of Error');
        }
      }
    });

    expect(message.error).toHaveBeenCalledWith('Failed to broadcast transaction');
  });

  it('should handle broadcast error', async () => {
    vi.mocked(broadcast.broadcast).mockRejectedValueOnce(new Error('Failed to broadcast'));

    const { result } = renderHook(() => useBroadcast());

    await act(async () => {
      try {
        await result.current.broadcast(
          mockPayload,
          mockUserSignature,
          mockSmallocatorSignature,
          mockContext
        );
      } catch (e) {
        if (e instanceof Error) {
          expect(e.message).toBe('Failed to broadcast');
        } else {
          throw new Error('Expected error to be instance of Error');
        }
      }
    });

    expect(message.error).toHaveBeenCalledWith('Failed to broadcast');
  });
});
