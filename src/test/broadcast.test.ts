import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BroadcastApiClient } from '../api/broadcast';

describe('BroadcastApiClient', () => {
  let client: BroadcastApiClient;

  beforeEach(() => {
    vi.stubEnv('VITE_BROADCAST_URL', 'http://localhost:3000');
    client = new BroadcastApiClient();
  });

  it('should broadcast message successfully', async () => {
    const mockRequest = {
      finalPayload: {
        compact: {
          chainId: '10',
          compact: {
            amount: '1000000000000000000',
            arbiter: '0xArbiterAddress',
            expires: '1732520000',
            id: '0xTokenIDForResourceLock',
            nonce: '0xUserAddressNonce',
            sponsor: '0xUserAddress',
            witnessHash: '0xWitnessHashValue',
            witnessTypeString:
              'ExampleWitness exampleWitness)ExampleWitness(uint256 foo, bytes32 bar)',
          },
        },
        userSignature: '0xUserSignature',
        smallocatorSignature: '0xSmallocatorSignature',
      },
    };

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
    const mockRequest = {
      finalPayload: {
        compact: {
          chainId: '10',
          compact: {
            amount: '1000000000000000000',
            arbiter: '0xArbiterAddress',
            expires: '1732520000',
            id: '0xTokenIDForResourceLock',
            nonce: '0xUserAddressNonce',
            sponsor: '0xUserAddress',
            witnessHash: '0xWitnessHashValue',
            witnessTypeString:
              'ExampleWitness exampleWitness)ExampleWitness(uint256 foo, bytes32 bar)',
          },
        },
        userSignature: '0xUserSignature',
        smallocatorSignature: '0xSmallocatorSignature',
      },
    };

    // Mock error response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Failed to broadcast' }),
    });

    await expect(client.broadcast(mockRequest)).rejects.toThrow('Failed to broadcast message');
  });
});
