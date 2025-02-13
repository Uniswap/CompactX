import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BroadcastApiClient } from '../api/broadcast';
import { recoverAddress, keccak256 } from 'viem';

vi.mock('viem', () => ({
  recoverAddress: vi.fn(),
  keccak256: vi.fn(),
  toBytes: vi.fn((_hex: string) => new Uint8Array([1, 2, 3])), // Mock implementation
  parseCompactSignature: vi.fn(() => ({ r: '0x123', s: '0x456', v: 27 })),
  compactSignatureToSignature: vi.fn(() => ({ r: '0x123', s: '0x456', v: 27 })),
  serializeSignature: vi.fn(() => '0x123456')
}));

describe('BroadcastApiClient', () => {
  let client: BroadcastApiClient;

  // Create valid test signatures
  const validSponsorSig = '0x' + '1'.repeat(128); // 64 bytes
  const validAllocatorSig = '0x' + '2'.repeat(128); // 64 bytes

  beforeEach(() => {
    vi.stubEnv('VITE_BROADCAST_URL', 'http://localhost:3000');
    client = new BroadcastApiClient();
    
    // Reset all mocks before each test
    vi.resetAllMocks();

    // Reset mock implementation for each test
    (recoverAddress as any).mockReset();

    // Mock keccak256 to return a consistent hash
    (keccak256 as any).mockReturnValue('0x' + '3'.repeat(64) as `0x${string}`);
  });

  const mockRequest = {
      chainId: '1',
      compact: {
        arbiter: '0x1234567890123456789012345678901234567890',
        sponsor: '0x2234567890123456789012345678901234567890',
        nonce: null,
        expires: '1732520000',
        id: '0x3234567890123456789012345678901234567890',
        amount: '1000000000000000000',
        mandate: {
          chainId: 10,
          tribunal: '0x6234567890123456789012345678901234567890',
          recipient: '0x4234567890123456789012345678901234567890',
          expires: '1732520000',
          token: '0x5234567890123456789012345678901234567890',
          minimumAmount: '1000000000000000000',
          baselinePriorityFee: '1000000000',
          scalingFactor: '1000000000000000000',
          salt: ('0x' + '01'.repeat(32)) as `0x${string}`,
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

  it('should verify signatures before broadcasting', async () => {
    // Mock successful signature verification
    (recoverAddress as any)
      .mockResolvedValueOnce('0x2234567890123456789012345678901234567890') // sponsor
      .mockResolvedValueOnce('0x51044301738Ba2a27bd9332510565eBE9F03546b'); // allocator

    const validRequest = {
      ...mockRequest,
      sponsorSignature: validSponsorSig,
      allocatorSignature: validAllocatorSig,
    };

    // Mock successful response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const response = await client.broadcast(validRequest);
    expect(response).toEqual({ success: true });
  });

  it('should reject invalid sponsor signature', async () => {
    // Mock failed sponsor verification
    (recoverAddress as any).mockResolvedValueOnce('0x0000000000000000000000000000000000000000');

    const invalidRequest = {
      ...mockRequest,
      sponsorSignature: '0x' + '9'.repeat(130),
      allocatorSignature: validAllocatorSig,
    };

    await expect(client.broadcast(invalidRequest)).rejects.toThrow('Invalid sponsor signature');
  });

  it('should reject invalid allocator signature', async () => {
    // Mock successful sponsor but failed allocator verification
    (recoverAddress as any)
      .mockResolvedValueOnce('0x2234567890123456789012345678901234567890') // sponsor succeeds
      .mockResolvedValueOnce('0x0000000000000000000000000000000000000000'); // allocator fails

    const invalidRequest = {
      ...mockRequest,
      sponsorSignature: validSponsorSig,
      allocatorSignature: '0x' + '9'.repeat(130),
    };

    await expect(client.broadcast(invalidRequest)).rejects.toThrow('Invalid allocator signature');
  });

  it('should handle malformed hex values', async () => {
    // Mock failed verification for malformed signature
    (recoverAddress as any).mockRejectedValueOnce(new Error('Invalid signature format'));

    const malformedRequest = {
      ...mockRequest,
      sponsorSignature: 'not-a-hex-string',
      allocatorSignature: validAllocatorSig,
    };

    await expect(client.broadcast(malformedRequest)).rejects.toThrow('Invalid sponsor signature');
  });

  it('should broadcast message successfully with valid signatures', async () => {
    // Mock successful signature verifications
    (recoverAddress as any)
      .mockResolvedValueOnce('0x2234567890123456789012345678901234567890') // sponsor
      .mockResolvedValueOnce('0x51044301738Ba2a27bd9332510565eBE9F03546b'); // allocator

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
    // Mock successful signature verifications
    (recoverAddress as any)
      .mockResolvedValueOnce('0x2234567890123456789012345678901234567890') // sponsor
      .mockResolvedValueOnce('0x51044301738Ba2a27bd9332510565eBE9F03546b'); // allocator

    // Mock error response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Failed to broadcast' }),
    });

    await expect(client.broadcast(mockRequest)).rejects.toThrow('Failed to broadcast message');
  });
});
