import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { SmallocatorClient } from '../api/smallocator';

// Mock environment variables
vi.stubEnv('VITE_SMALLOCATOR_URL', 'https://smallocator.xyz');

describe('SmallocatorClient', () => {
  let client: SmallocatorClient;

  beforeEach(() => {
    client = new SmallocatorClient();
    localStorage.clear();
    vi.clearAllMocks();
  });

  const mockCompactRequest = {
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

  it('should get session payload', async () => {
    const mockPayload = {
      domain: 'compactx.xyz',
      address: '0xUserAddress',
      uri: 'https://compactx.xyz',
      statement: 'Sign in to CompactX',
      version: '1',
      chainId: 10,
      nonce: '123456',
      issuedAt: new Date().toISOString(),
      expirationTime: new Date(Date.now() + 3600000).toISOString(),
    };

    // Mock successful response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session: mockPayload }),
    });

    const response = await client.getSessionPayload(10, '0xUserAddress');
    expect(response).toEqual({ session: mockPayload });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://smallocator.xyz/session/10/0xUserAddress',
      expect.objectContaining({
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );
  });

  it('should create a new session', async () => {
    const mockRequest = {
      signature: ('0x' + '00'.repeat(65)) as `0x${string}`,
      payload: {
        domain: 'compactx.xyz',
        address: '0x1234567890123456789012345678901234567890',
        uri: 'https://compactx.xyz',
        statement: 'Sign in to CompactX',
        version: '1',
        chainId: 1,
        nonce: '123456',
        issuedAt: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 3600000).toISOString(),
      },
    };

    const mockResponse = {
      session: {
        id: 'test-session-id',
      },
    };

    // Mock successful response
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const response = await client.createSession(mockRequest);

    expect(response).toEqual({ sessionId: 'test-session-id' });
    expect(fetch).toHaveBeenCalledWith(
      `${import.meta.env.VITE_SMALLOCATOR_URL}/session`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(mockRequest),
      })
    );
  });

  it('should submit compact', async () => {
    const mockResponse = {
      hash: ('0x' + '00'.repeat(32)) as `0x${string}`,
      signature: ('0x' + '00'.repeat(65)) as `0x${string}`,
      nonce: ('0x' + '00'.repeat(32)) as `0x${string}`,
    };

    // Mock successful response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    // Set session ID to test header inclusion
    localStorage.setItem('sessionId', 'unique_session_id');
    client = new SmallocatorClient(); // Reinitialize to pick up session ID

    const response = await client.submitCompact(mockCompactRequest);
    expect(response).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://smallocator.xyz/compact',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': 'unique_session_id',
        },
        body: JSON.stringify(mockCompactRequest),
      })
    );
  });

  it('should handle API errors', async () => {
    // Mock error response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid request' }),
    });

    await expect(client.getSessionPayload(10, '0xUserAddress')).rejects.toThrow('Invalid request');
  });
});
