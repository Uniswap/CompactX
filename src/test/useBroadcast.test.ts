import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBroadcast } from '../hooks/useBroadcast';
import { renderHook, act } from '@testing-library/react';
import { message } from 'antd';
import { BroadcastApiClient } from '../api/broadcast';

vi.mock('antd', () => ({
  message: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.stubEnv('VITE_BROADCAST_URL', 'http://localhost:3000');

class MockBroadcastApiClient extends BroadcastApiClient {
  broadcast = vi.fn().mockResolvedValue({ success: true });
}

vi.mock('../api/broadcast', () => ({
  BroadcastApiClient: vi.fn().mockImplementation(() => {
    return new MockBroadcastApiClient();
  })
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

const mockContext = {
  dispensation: "1000000000",
  dispensationUSD: "1.00",
  spotOutputAmount: "1000000000000000000",
  quoteOutputAmountDirect: "990000000000000000",
  quoteOutputAmountNet: "980000000000000000",
  allocatorId: "1",
  resetPeriod: 0,
  isMultichain: true,
  slippageBips: 100,
  witnessTypeString: "Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)",
  witnessHash: "0x1234567890123456789012345678901234567890123456789012345678901234"
};

const mockUserSignature = ('0x' + '00'.repeat(65)) as `0x${string}`;
const mockSmallocatorSignature = ('0x' + '00'.repeat(65)) as `0x${string}`;

describe('useBroadcast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should broadcast successfully', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useBroadcast());

    await act(async () => {
      await result.current.broadcast(mockPayload, mockUserSignature, mockSmallocatorSignature, mockContext);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/broadcast'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining(mockUserSignature),
      })
    );
    expect(message.success).toHaveBeenCalledWith('Transaction broadcast successfully');
  });

  it('should handle broadcast failure', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Network error' }),
    });

    const { result } = renderHook(() => useBroadcast());

    await act(async () => {
      await expect(
        result.current.broadcast(mockPayload, mockUserSignature, mockSmallocatorSignature, mockContext)
      ).rejects.toThrow();
    });

    expect(message.error).toHaveBeenCalled();
    expect(result.current.error).toBeTruthy();
  });

  it('should handle broadcast error', async () => {
    const errorMock = new MockBroadcastApiClient();
    errorMock.broadcast.mockRejectedValueOnce(new Error('Failed to broadcast message'));
    vi.mocked(BroadcastApiClient).mockImplementationOnce(() => errorMock);

    const { result } = renderHook(() => useBroadcast());

    await act(async () => {
      await expect(
        result.current.broadcast(mockPayload, mockUserSignature, mockSmallocatorSignature, mockContext)
      ).rejects.toThrow('Failed to broadcast message');
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
