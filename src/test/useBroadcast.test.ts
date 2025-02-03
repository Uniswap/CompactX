import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBroadcast } from '../hooks/useBroadcast';
import { renderHook, act } from '@testing-library/react';
import { message } from 'antd';

vi.mock('antd', () => ({
  message: {
    success: vi.fn(),
    error: vi.fn(),
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
      await result.current.broadcast(mockPayload, mockUserSignature, mockSmallocatorSignature);
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
        result.current.broadcast(mockPayload, mockUserSignature, mockSmallocatorSignature)
      ).rejects.toThrow();
    });

    expect(message.error).toHaveBeenCalled();
    expect(result.current.error).toBeTruthy();
  });
});
