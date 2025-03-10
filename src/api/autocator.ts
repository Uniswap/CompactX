// Types
export interface CompactMessage {
  arbiter: string;
  sponsor: string;
  nonce: string | null;
  expires: string;
  id: string;
  amount: string;
  witnessHash: string;
  witnessTypeString: string;
}

export interface CompactRequest {
  chainId: string;
  compact: CompactMessage;
  sponsorSignature?: string;
}

export interface CompactResponse {
  hash: string;
  signature: string;
  nonce: string;
}

export interface ResourceLockBalance {
  allocatableBalance: string;
  allocatedBalance: string;
  balanceAvailableToAllocate: string;
  withdrawalStatus: number;
}

// Type guard for CompactResponse
export const isCompactResponse = (data: unknown): data is CompactResponse => {
  if (!data || typeof data !== 'object') return false;
  const response = data as CompactResponse;
  return (
    typeof response.hash === 'string' &&
    typeof response.signature === 'string' &&
    typeof response.nonce === 'string'
  );
};

// Type guard for CompactRequest
export function isCompactRequest(data: unknown): data is CompactRequest {
  if (!data || typeof data !== 'object') return false;

  const request = data as CompactRequest;
  if (typeof request.chainId !== 'string') return false;

  const compact = request.compact;
  if (!compact) return false;

  return (
    typeof compact.arbiter === 'string' &&
    typeof compact.sponsor === 'string' &&
    (compact.nonce === null || typeof compact.nonce === 'string') &&
    typeof compact.expires === 'string' &&
    typeof compact.id === 'string' &&
    typeof compact.amount === 'string' &&
    typeof compact.witnessHash === 'string' &&
    typeof compact.witnessTypeString === 'string'
  );
}

// Convert a signature to EIP-2098 compact format
function signatureToCompactSignature({ r, s, yParity }: { r: string; s: string; yParity: number }) {
  return {
    r,
    yParityAndS: `0x${yParity.toString(16).padStart(2, '0')}${s.slice(2)}`,
  };
}

// API Client
export class AutocatorClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || 'https://autocator.org';
  }

  /**
   * Make a request to the API
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    endpoint: string,
    data?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    console.log('Making request to Autocator:', {
      url: `${this.baseUrl}${endpoint}`,
      method,
      headers,
      body: data,
    });

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    // Now we know we have a response
    let result;
    try {
      result = await response.json();
    } catch (error) {
      // Response is not JSON
      if (!response.ok) {
        throw new Error(
          `Request failed (${response.status}): The server returned an invalid response. Please try again later.`
        );
      }
      // For DELETE requests, empty response is OK
      if (method === 'DELETE' && response.ok) {
        return {} as T;
      }
      const message = error instanceof Error ? error.message : 'Invalid Response Format';
      throw new Error(`Invalid response format: ${message}. Please try again later.`);
    }

    if (!response.ok) {
      const error = result.error || `Request failed with status ${response.status}`;
      throw new Error(error);
    }

    return result;
  }

  /**
   * Get a suggested nonce for a specific chain and account
   * @param chainId - The chain ID to get a nonce for
   * @param account - The account address
   */
  async getSuggestedNonce(chainId: string | number, account: string): Promise<string> {
    const response = await this.request<{ nonce: string }>(
      'GET',
      `/suggested-nonce/${chainId}/${account}`
    );
    return response.nonce;
  }

  /**
   * Get the balance for a specific resource lock
   * @param chainId - The chain ID
   * @param lockId - The resource lock ID
   */
  async getResourceLockBalance(
    chainId: string | number,
    lockId: string
  ): Promise<ResourceLockBalance> {
    return this.request<ResourceLockBalance>('GET', `/balance/${chainId}/${lockId}`);
  }

  /**
   * Submit a compact message for signing by Autocator
   * @param request - The compact message request
   */
  async submitCompact(
    request: CompactRequest,
    options: { isDepositAndSwap?: boolean } = {}
  ): Promise<CompactResponse> {
    if (!isCompactRequest(request)) {
      throw new Error(
        'Invalid compact request format. This may be due to a version mismatch. Please ensure you are using the latest version.'
      );
    }

    // Use the compact.id as the resource lock ID
    const lockId = request.compact.id;

    // Get current balance
    const balance = await this.getResourceLockBalance(request.chainId, lockId);

    // Check if there's enough available balance
    const requiredAmount = BigInt(request.compact.amount);
    const availableBalance = BigInt(balance.balanceAvailableToAllocate);

    // Always log the balance check results
    console.log('Balance check:', {
      required: requiredAmount.toString(),
      available: availableBalance.toString(),
      isDepositAndSwap: options.isDepositAndSwap,
      witnessTypeString: request.compact.witnessTypeString,
    });

    if (availableBalance < requiredAmount) {
      const error = `Insufficient balance available to allocate. Required: ${requiredAmount.toString()}, Available: ${availableBalance.toString()}`;
      console.error(error);
      throw new Error(error);
    }

    const response = await this.request<CompactResponse>('POST', '/compact', request);
    if (!isCompactResponse(response)) {
      throw new Error(
        'Invalid compact response format. The server response was not in the expected format. Please try again later.'
      );
    }

    // Compact the signature if it's 65 bytes long
    if (response.signature.length === 132) {
      const r = response.signature.slice(0, 66);
      const s = '0x' + response.signature.slice(66, 130);
      const v = parseInt(response.signature.slice(130, 132), 16);
      const compact = signatureToCompactSignature({ r, s, yParity: v - 27 });
      response.signature = compact.r + compact.yParityAndS.slice(2);
    }

    return response;
  }
}

// Export a singleton instance
export const autocator = new AutocatorClient();

// Export methods from the singleton instance
export const { submitCompact } = autocator;
