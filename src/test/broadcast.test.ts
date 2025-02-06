import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BroadcastApiClient } from '../api/broadcast';

describe('BroadcastApiClient', () => {
  let client: BroadcastApiClient;

  beforeEach(() => {
    vi.stubEnv('VITE_BROADCAST_URL', 'http://localhost:3000');
    client = new BroadcastApiClient();
  });

  const mockRequest = {
      compact: {
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
            salt: ('0x' + '01'.repeat(32)) as `0x${string}`,
          },
        },
      },
      sponsorSignature: ('0x' + '00'.repeat(65)) as `0x${string}`,
      allocatorSignature: ('0x' + '00'.repeat(65)) as `0x${string}`,
      context: {
        slippageBips: 100,
        recipient: '0x1234567890123456789012345678901234567890',
        baselinePriorityFee: '0',
        scalingFactor: '1000000000100000000',
        expires: '1732520000',
        witnessTypeString: 'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
        witnessHash: '0x' + '02'.repeat(32),
      }
  };

  it('should broadcast message successfully', async () => {
    // Mock successful response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const response = await client.broadcast(mockRequest);
    expect(response).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/broadcast',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockRequest),
      })
    );
  });

  it('should handle broadcast errors', async () => {
    // Mock error response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Failed to broadcast' }),
    });

    await expect(client.broadcast(mockRequest)).rejects.toThrow('Failed to broadcast message');
  });
});
