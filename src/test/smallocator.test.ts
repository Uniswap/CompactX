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
      witnessTypeString:
        'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
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

  it('should get resource lock balance', async () => {
    const mockBalance = {
      allocatableBalance: '2000000000000000000',
      allocatedBalance: '500000000000000000',
      balanceAvailableToAllocate: '1500000000000000000',
      withdrawalStatus: 0,
    };

    // Mock successful response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockBalance,
    });

    const response = await client.getResourceLockBalance('1', '0x1234');
    expect(response).toEqual(mockBalance);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://smallocator.xyz/balance/1/0x1234',
      expect.objectContaining({
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );
  });

  it('should submit compact without retries for non-Deposit & Swap operations when balance is sufficient', async () => {
    const mockBalance = {
      allocatableBalance: '2000000000000000000',
      allocatedBalance: '500000000000000000',
      balanceAvailableToAllocate: '1500000000000000000',
      withdrawalStatus: 0,
    };

    const mockResponse = {
      hash: ('0x' + '00'.repeat(32)) as `0x${string}`,
      signature: ('0x' + '00'.repeat(65)) as `0x${string}`,
      nonce: ('0x' + '00'.repeat(32)) as `0x${string}`,
    };

    // Mock successful balance check then successful compact submission
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBalance,
      })
      .mockResolvedValueOnce({
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

    // Verify both API calls were made correctly
    expect(global.fetch).toHaveBeenCalledTimes(2);

    // Verify balance check
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      `https://smallocator.xyz/balance/1/${mockCompactRequest.compact.id}`,
      expect.objectContaining({
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': 'unique_session_id',
        },
      })
    );

    // Verify compact submission
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
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

  it('should fail to submit compact when balance is insufficient', async () => {
    const mockBalance = {
      allocatableBalance: '1000000000000000000',
      allocatedBalance: '500000000000000000',
      balanceAvailableToAllocate: '500000000000000000',
      withdrawalStatus: 0,
    };

    // Create a request with amount higher than available balance
    const highAmountRequest: CompactRequest = {
      ...mockCompactRequest,
      compact: {
        ...mockCompactRequest.compact,
        amount: '900000000000000000', // Higher than balanceAvailableToAllocate
      },
    };

    // Mock successful balance check
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockBalance,
    });

    // Expect the operation to fail due to insufficient balance
    await expect(client.submitCompact(highAmountRequest)).rejects.toThrow(
      'Insufficient balance available to allocate. Required: 900000000000000000, Available: 500000000000000000'
    );

    // Verify only the balance check was made
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      `https://smallocator.xyz/balance/1/${highAmountRequest.compact.id}`,
      expect.objectContaining({
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
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
