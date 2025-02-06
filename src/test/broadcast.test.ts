import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BroadcastApiClient } from '../api/broadcast';

describe('BroadcastApiClient', () => {
  let client: BroadcastApiClient;

  beforeEach(() => {
    vi.stubEnv('VITE_BROADCAST_URL', 'http://localhost:3000');
    client = new BroadcastApiClient();
  });

  const mockRequest = {
    finalPayload: {
      chainId: "1",
      compact: {
        arbiter: "0x1234567890123456789012345678901234567890",
        sponsor: "0x1234567890123456789012345678901234567890",
        nonce: null,
        expires: "1234567890",
        id: "1",
        amount: "1000000000000000000",
        mandate: {
          chainId: 1,
          tribunal: "0x1234567890123456789012345678901234567890",
          recipient: "0x1234567890123456789012345678901234567890",
          expires: "1234567890",
          token: "0x1234567890123456789012345678901234567890",
          minimumAmount: "1000000000000000000",
          baselinePriorityFee: "1000000000",
          scalingFactor: "1000000000",
          salt: "0x1234567890123456789012345678901234567890123456789012345678901234" as `0x${string}`
        }
      },
      sponsorSignature: "0x1234567890123456789012345678901234567890123456789012345678901234",
      allocatorSignature: "0x1234567890123456789012345678901234567890123456789012345678901234",
      context: {
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
      }
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
