import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  it('should get session payload', async () => {
    const mockResponse = {
      payload: {
        domain: 'compactx.xyz',
        address: '0xUserAddress',
        uri: 'https://compactx.xyz',
        statement: 'Sign in to CompactX',
        version: '1',
        chainId: 10,
        nonce: '123456',
        issuedAt: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 3600000).toISOString(),
      },
    };

    // Mock successful response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const response = await client.getSessionPayload(10, '0xUserAddress');
    expect(response).toEqual(mockResponse);
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

  it('should create session', async () => {
    const mockRequest = {
      signature: '0xUserSignedSignature',
      payload: {
        domain: 'compactx.xyz',
        address: '0xUserAddress',
        uri: 'https://compactx.xyz',
        statement: 'Sign in to CompactX',
        version: '1',
        chainId: 10,
        nonce: '123456',
        issuedAt: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 3600000).toISOString(),
      },
    };

    const mockResponse = {
      sessionId: 'unique_session_id',
    };

    // Mock successful response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const response = await client.createSession(mockRequest);
    expect(response).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://smallocator.xyz/session',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockRequest),
      })
    );
  });

  it('should submit compact', async () => {
    const mockRequest = {
      chainId: '10',
      compact: {
        amount: '1000000000000000000',
        arbiter: '0xArbiterAddress',
        expires: '1732520000',
        id: '0xTokenIDForResourceLock',
        nonce: '0xUserAddressNonce',
        sponsor: '0xUserAddress',
        witnessHash: '0xWitnessHashValue',
        witnessTypeString: 'ExampleWitness exampleWitness)ExampleWitness(uint256 foo, bytes32 bar)',
      },
    };

    const mockResponse = {
      hash: '0xTransactionHash',
      signature: '0xSmallSignature',
      nonce: '0xUserAddressNonce',
    };

    // Mock successful response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    // Set session ID to test header inclusion
    localStorage.setItem('sessionId', 'unique_session_id');
    client = new SmallocatorClient(); // Reinitialize to pick up session ID

    const response = await client.submitCompact(mockRequest);
    expect(response).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://smallocator.xyz/compact',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': 'unique_session_id',
        },
        body: JSON.stringify(mockRequest),
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
