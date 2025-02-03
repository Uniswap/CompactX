import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import axios from 'axios';
import { BroadcastClient } from '../api/broadcast';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('BroadcastClient', () => {
  let client: BroadcastClient;

  beforeEach(() => {
    client = new BroadcastClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should broadcast final payload', async () => {
    const mockRequest = {
      finalPayload: {
        compact: {
          arbiter: '0xArbiterAddress',
          sponsor: '0xUserAddress',
          nonce: '0xUserAddressNonce',
          expires: '1732520000',
          id: '0xTokenIDForResourceLock',
          amount: '1000000000000000000',
          witnessTypeString:
            'ExampleWitness exampleWitness)ExampleWitness(uint256 foo, bytes32 bar)',
          witnessHash: '0xWitnessHashValue',
        },
        userSignature: '0xUserSignature',
        smallocatorSignature: '0xSmallocatorSignature',
      },
    };

    const mockResponse = {
      data: {
        status: 'success',
        message: 'Trade broadcasted successfully',
      },
    };

    mockedAxios.mockResolvedValueOnce(mockResponse);

    const response = await client.broadcast(mockRequest);
    expect(response).toEqual(mockResponse.data);
    expect(mockedAxios).toHaveBeenCalledWith({
      method: 'POST',
      url: 'https://broadcast.xyz/broadcast',
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

    await expect(
      client.broadcast({
        finalPayload: {
          compact: {
            arbiter: '0xArbiterAddress',
            sponsor: '0xUserAddress',
            nonce: '0xUserAddressNonce',
            expires: '1732520000',
            id: '0xTokenIDForResourceLock',
            amount: '1000000000000000000',
            witnessTypeString:
              'ExampleWitness exampleWitness)ExampleWitness(uint256 foo, bytes32 bar)',
            witnessHash: '0xWitnessHashValue',
          },
          userSignature: '0xUserSignature',
          smallocatorSignature: '0xSmallocatorSignature',
        },
      })
    ).rejects.toThrow('Broadcast API error: Invalid signature');
  });
});
