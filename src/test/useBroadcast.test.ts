import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBroadcast } from '../hooks/useBroadcast';
import { message } from 'antd';
import { broadcast } from '../api/broadcast';
import { keccak256 } from 'viem';

vi.mock('viem', () => ({
  keccak256: vi.fn(input => {
    // Return consistent hash for type strings
    if (typeof input === 'string') {
      if (input.startsWith('Compact(')) {
        return '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`;
      }
      if (input.startsWith('Mandate(')) {
        return '0x2345678901234567890123456789012345678901234567890123456789012345' as `0x${string}`;
      }
    }
    // Return different hash for encoded parameters
    return '0x3333333333333333333333333333333333333333333333333333333333333333' as `0x${string}`;
  }),
  toBytes: vi.fn(str => str), // Return the string directly instead of converting to Uint8Array
  encodeAbiParameters: vi.fn(() => '0x123456'),
}));

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
    nonce: '123456', // Set default nonce
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
  witnessTypeString:
    'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
  witnessHash: '0x588c2fb2d70e2a69fef05cc28efaeb13e363a9ab6d06ea9de3dda2a4b09f1761',
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
      chainId: mockPayload.chainId,
      compact: {
        ...mockPayload.compact,
        mandate: {
          ...mockPayload.compact.mandate,
          chainId: Number(mockPayload.chainId),
        },
      },
      sponsorSignature: mockUserSignature,
      allocatorSignature: mockSmallocatorSignature,
      context: {
        ...mockContext,
        claimHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
        witnessHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
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
      await expect(
        result.current.broadcast(
          mockPayload,
          mockUserSignature,
          mockSmallocatorSignature,
          mockContext
        )
      ).rejects.toThrow('Network error');
    });

    expect(result.current.error).toBe(error);
    expect(message.error).toHaveBeenCalledWith('Network error');
  });

  it('should handle broadcast failure', async () => {
    vi.mocked(broadcast.broadcast).mockResolvedValueOnce({ success: false });

    const { result } = renderHook(() => useBroadcast());

    await expect(
      result.current.broadcast(
        mockPayload,
        mockUserSignature,
        mockSmallocatorSignature,
        mockContext
      )
    ).rejects.toThrow('Failed to broadcast transaction');

    expect(message.error).toHaveBeenCalledWith('Failed to broadcast transaction');
  });

  it('should handle broadcast error', async () => {
    vi.mocked(broadcast.broadcast).mockRejectedValueOnce(new Error('Failed to broadcast'));

    const { result } = renderHook(() => useBroadcast());

    await expect(
      result.current.broadcast(
        mockPayload,
        mockUserSignature,
        mockSmallocatorSignature,
        mockContext
      )
    ).rejects.toThrow('Failed to broadcast');

    expect(message.error).toHaveBeenCalledWith('Failed to broadcast');
  });

  it('should throw error if nonce is missing', async () => {
    const payloadWithoutNonce = {
      ...mockPayload,
      compact: {
        ...mockPayload.compact,
        nonce: null,
      },
    };

    const { result } = renderHook(() => useBroadcast());

    await expect(
      result.current.broadcast(
        payloadWithoutNonce,
        mockUserSignature,
        mockSmallocatorSignature,
        mockContext
      )
    ).rejects.toThrow('Nonce is required for deriving claim hash');
  });

  it('should derive claim hash correctly', async () => {
    vi.mocked(broadcast.broadcast).mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useBroadcast());

    const response = await result.current.broadcast(
      mockPayload,
      mockUserSignature,
      mockSmallocatorSignature,
      mockContext
    );

    expect(response).toEqual({ success: true });
    expect(keccak256).toHaveBeenCalledWith(
      expect.stringContaining(
        'Compact(address arbiter,address sponsor,uint256 nonce,uint256 expires,uint256 id,uint256 amount,Mandate mandate)'
      )
    );
  });
});
