import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { SmallocatorClient } from '../api/smallocator';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('SmallocatorClient', () => {
  let client: SmallocatorClient;

  beforeEach(() => {
    // Mock environment variable
    vi.stubEnv('VITE_SMALLOCATOR_URL', 'https://smallocator.xyz');
    client = new SmallocatorClient();
  });

  it('should get session payload', async () => {
    const mockResponse = {
      data: {
        payload: {
          domain: 'your-dapp-domain.com',
          address: '0xUserAddress',
          uri: 'https://your-dapp-domain.com',
          statement: 'Sign in to Smallocator',
          version: '1',
          chainId: 10,
          nonce: 'unique_nonce_value',
          issuedAt: '2025-02-03T10:00:00Z',
          expirationTime: '2025-02-03T11:00:00Z',
        },
      },
    };

    mockedAxios.mockResolvedValueOnce(mockResponse);

    const response = await client.getSessionPayload(10, '0xUserAddress');
    expect(response).toEqual(mockResponse.data);
    expect(mockedAxios).toHaveBeenCalledWith({
      method: 'GET',
      url: 'https://smallocator.xyz/session/10/0xUserAddress',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('should create session', async () => {
    const mockRequest = {
      signature: '0xUserSignedSignature',
      payload: {
        domain: 'your-dapp-domain.com',
        address: '0xUserAddress',
        uri: 'https://your-dapp-domain.com',
        statement: 'Sign in to Smallocator',
        version: '1',
        chainId: 10,
        nonce: 'unique_nonce_value',
        issuedAt: '2025-02-03T10:00:00Z',
        expirationTime: '2025-02-03T11:00:00Z',
      },
    };

    const mockResponse = {
      data: {
        sessionId: 'unique_session_id',
      },
    };

    mockedAxios.mockResolvedValueOnce(mockResponse);

    const response = await client.createSession(mockRequest);
    expect(response).toEqual(mockResponse.data);
    expect(mockedAxios).toHaveBeenCalledWith({
      method: 'POST',
      url: 'https://smallocator.xyz/session',
      data: mockRequest,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('should submit compact', async () => {
    const mockRequest = {
      chainId: '10',
      compact: {
        arbiter: '0xArbiterAddress',
        sponsor: '0xUserAddress',
        nonce: '0xUserAddressNonce',
        expires: '1732520000',
        id: '0xTokenIDForResourceLock',
        amount: '1000000000000000000',
        witnessTypeString: 'ExampleWitness exampleWitness)ExampleWitness(uint256 foo, bytes32 bar)',
        witnessHash: '0xWitnessHashValue',
      },
    };

    const mockResponse = {
      data: {
        hash: '0xComputedClaimHash',
        signature: '0xSmallocatorSignature',
        nonce: '0xUserAddressNonce',
      },
    };

    mockedAxios.mockResolvedValueOnce(mockResponse);

    const response = await client.submitCompact(mockRequest);
    expect(response).toEqual(mockResponse.data);
    expect(mockedAxios).toHaveBeenCalledWith({
      method: 'POST',
      url: 'https://smallocator.xyz/compact',
      data: mockRequest,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('should handle API errors', async () => {
    const error = new Error('Invalid signature') as Error & {
      isAxiosError: boolean;
      response: { data: { message: string } };
    };
    error.isAxiosError = true;
    error.response = {
      data: {
        message: 'Invalid signature',
      },
    };

    mockedAxios.mockRejectedValueOnce(error);

    await expect(client.getSessionPayload(10, '0xUserAddress')).rejects.toThrow(
      'Smallocator API error: Invalid signature'
    );
  });
});
