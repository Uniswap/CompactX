import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { SmallocatorClient, CompactRequest } from '../api/smallocator';

// Mock environment variables
vi.stubEnv('VITE_SMALLOCATOR_URL', 'https://smallocator.xyz');

describe('SmallocatorClient', () => {
  let client: SmallocatorClient;

  beforeEach(() => {
    client = new SmallocatorClient();
    localStorage.clear();
    vi.clearAllMocks();
  });

  const mockCompactRequest: CompactRequest = {
    chainId: '1',
    compact: {
      arbiter: '0x1234567890123456789012345678901234567890',
      sponsor: '0x2234567890123456789012345678901234567890',
      nonce: null,
      expires: '1732520000',
      id: '0x3234567890123456789012345678901234567890',
      amount: '1000000000000000000',
      witnessHash: ('0x' + '02'.repeat(32)) as `0x${string}`,
      witnessTypeString: 'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)'
    }
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

  it('should submit compact without retries for non-Deposit & Swap operations', async () => {
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
    const mockAddress = '0x1234567890123456789012345678901234567890';
    const sessions = { [mockAddress.toLowerCase()]: 'unique_session_id' };
    localStorage.setItem('smallocator_sessions', JSON.stringify(sessions));
    client = new SmallocatorClient(); // Reinitialize to pick up session ID
    client.setTestSessionId('unique_session_id'); // Set the session ID directly

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

  it('should retry 5 times on Deposit & Swap operations', async () => {
    const mockResponse = {
      hash: ('0x' + '00'.repeat(32)) as `0x${string}`,
      signature: ('0x' + '00'.repeat(65)) as `0x${string}`,
      nonce: ('0x' + '00'.repeat(32)) as `0x${string}`,
    };

    // Create a request with Deposit & Swap witnessTypeString
    const depositSwapRequest: CompactRequest = {
      ...mockCompactRequest,
      compact: {
        ...mockCompactRequest.compact,
        witnessTypeString: 'DepositAndSwap(uint256,address,uint256)'
      }
    };

    // Mock fetch to fail 4 times then succeed
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('Failed attempt 1'))
      .mockRejectedValueOnce(new Error('Failed attempt 2'))
      .mockRejectedValueOnce(new Error('Failed attempt 3'))
      .mockRejectedValueOnce(new Error('Failed attempt 4'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });
    
    global.fetch = mockFetch;

    // Start the operation
    const promise = client.submitCompact(depositSwapRequest);
    
    // Advance time by 1 second for each retry
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(1000);
    }

    const response = await promise;
    expect(response).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledTimes(5); // Initial attempt + 4 retries

    vi.useRealTimers();
  });

  it('should fail after 5 attempts for Deposit & Swap operations', async () => {
    
    // Create a request with Deposit & Swap witnessTypeString
    const depositSwapRequest: CompactRequest = {
      ...mockCompactRequest,
      compact: {
        ...mockCompactRequest.compact,
        witnessTypeString: 'DepositAndSwap(uint256,address,uint256)'
      }
    };

    // Mock fetch to always fail
    const mockFetch = vi.fn().mockRejectedValue(new Error('Operation failed'));
    global.fetch = mockFetch;

    // Start the operation
    const promise = client.submitCompact(depositSwapRequest);
    
    // Advance time for each retry attempt
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(1000);
    }

    await expect(promise).rejects.toThrow('Operation failed after all retry attempts');
    expect(mockFetch).toHaveBeenCalledTimes(5); // Initial attempt + 4 retries

    vi.useRealTimers();
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
