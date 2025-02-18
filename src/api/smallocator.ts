// Types
export interface SessionPayload {
  domain: string;
  address: string;
  uri: string;
  statement: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
}

export interface CreateSessionRequest {
  signature: string;
  payload: SessionPayload;
}

export interface CreateSessionResponse {
  session: {
    id: string;
  };
}

export interface SessionResponse {
  session: SessionPayload;
}

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
}

export interface CompactResponse {
  hash: string;
  signature: string;
  nonce: string;
}

// Convert a signature to EIP-2098 compact format
function signatureToCompactSignature({ r, s, yParity }: { r: string; s: string; yParity: number }) {
  return {
    r,
    yParityAndS: `0x${yParity.toString(16).padStart(2, '0')}${s.slice(2)}`,
  };
}

export interface SessionVerifyResponse {
  session: {
    id: string;
    address: string;
    expiresAt: string;
  };
}

export interface ErrorResponse {
  error: string;
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

// API Client
export class SmallocatorClient {
  private baseUrl: string;
  private sessionId: string | null = null;
  private readonly SESSION_KEY = 'smallocator_sessions';

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || import.meta.env.VITE_SMALLOCATOR_URL;
    if (!this.baseUrl) {
      throw new Error('VITE_SMALLOCATOR_URL environment variable is not set');
    }
  }

  private getSessionsMap(): Record<string, string> {
    const sessions = localStorage.getItem(this.SESSION_KEY);
    return sessions ? JSON.parse(sessions) : {};
  }

  private setSessionsMap(sessions: Record<string, string>): void {
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessions));
  }

  private getSessionForAddress(address: string): string | null {
    const sessions = this.getSessionsMap();
    return sessions[address.toLowerCase()] || null;
  }

  private setSessionForAddress(address: string, sessionId: string): void {
    const sessions = this.getSessionsMap();
    sessions[address.toLowerCase()] = sessionId;
    this.setSessionsMap(sessions);
    this.sessionId = sessionId;
  }

  private removeSessionForAddress(address: string): void {
    const sessions = this.getSessionsMap();
    delete sessions[address.toLowerCase()];
    this.setSessionsMap(sessions);
    this.sessionId = null;
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

    if (this.sessionId) {
      headers['x-session-id'] = this.sessionId;
    }

    console.log('Making request:', {
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
      if (error.includes('Invalid session') || error.includes('expired')) {
        this.clearSession();
      }
      throw new Error(error);
    }

    return result;
  }

  /**
   * Get a suggested nonce for a specific chain
   * @param chainId - The chain ID to get a nonce for
   */
  async getSuggestedNonce(chainId: string | number): Promise<string> {
    const response = await this.request<{ nonce: string }>('GET', `/suggested-nonce/${chainId}`);
    return response.nonce;
  }

  /**
   * Get session payload for signing
   * @param chainId - The chain ID (e.g., 10 for Optimism)
   * @param address - The user's wallet address
   */
  async getSessionPayload(chainId: number, address: string): Promise<SessionResponse> {
    return this.request<SessionResponse>('GET', `/session/${chainId}/${address}`);
  }

  /**
   * Create a new session with a signed payload
   * @param request - The signed session payload
   */
  async createSession(request: CreateSessionRequest): Promise<{ sessionId: string }> {
    const response = await this.request<CreateSessionResponse>('POST', '/session', request);
    // Store the session ID mapped to the address
    if (response.session.id && request.payload.address) {
      this.setSessionForAddress(request.payload.address, response.session.id);
    }
    return { sessionId: response.session.id };
  }

  /**
   * Submit a compact message for signing by Smallocator
   * @param request - The compact message request
   */
  private async submitCompactWithRetry(
    request: CompactRequest,
    maxRetries: number = 5
  ): Promise<CompactResponse> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
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
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error occurred');
        if (attempt === maxRetries) {
          throw lastError;
        }
        // Wait for 1 second before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw lastError || new Error('Unknown error occurred');
  }

  /**
   * Get the balance for a specific resource lock
   * @param chainId - The chain ID
   * @param lockId - The resource lock ID
   */
  async getResourceLockBalance(chainId: string | number, lockId: string): Promise<ResourceLockBalance> {
    return this.request<ResourceLockBalance>('GET', `/balance/${chainId}/${lockId}`);
  }

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
      witnessTypeString: request.compact.witnessTypeString
    });
    
    if (availableBalance < requiredAmount) {
      const error = `Insufficient balance available to allocate. Required: ${requiredAmount.toString()}, Available: ${availableBalance.toString()}`;
      console.error(error);
      throw new Error(error);
    }

    if (options.isDepositAndSwap) {
      // Use retry logic for Deposit & Swap operations
      return this.submitCompactWithRetry(request);
    } else {
      // For other operations, just make a single attempt
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

  /**
   * Verify the current session
   * @returns Object with valid status and optional error message
   */
  async verifySession(address?: string): Promise<{
    valid: boolean;
    error?: string;
    session?: SessionVerifyResponse['session'];
  }> {
    // If address is provided, use its specific session
    if (address) {
      this.sessionId = this.getSessionForAddress(address);
    }

    if (!this.sessionId) {
      return { valid: false, error: 'No active session found. Please sign in again to continue.' };
    }

    try {
      const response = await this.request<SessionVerifyResponse>('GET', '/session');

      // If we get a successful response, the session is valid
      // Verify the session belongs to the correct address if one was provided
      if (address && response.session.address.toLowerCase() !== address.toLowerCase()) {
        throw new Error('Session address mismatch');
      }

      return { valid: true, session: response.session };
    } catch (error) {
      // Clear session if it's invalid or expired
      if (
        error instanceof Error &&
        (error.message.includes('Invalid session') ||
          error.message.includes('expired') ||
          error.message.includes('Session address mismatch'))
      ) {
        if (address) {
          this.removeSessionForAddress(address);
        }
      }

      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Session verification failed',
      };
    }
  }

  /**
   * Delete the current session
   */
  public async deleteSession(): Promise<void> {
    if (!this.sessionId) {
      return;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-session-id': this.sessionId,
    };

    let response: Response | undefined;

    try {
      response = await fetch(`${this.baseUrl}/session`, {
        method: 'DELETE',
        headers,
      });

      if (!response) {
        throw new Error('No response received from server');
      }

      if (!response.ok) {
        let errorMessage = 'Failed to delete session. Please try again later.';
        try {
          const result = await response.json();
          if (result.error) {
            errorMessage = result.error;
          }
        } catch {
          // If we can't parse the error, use the default message
        }
        throw new Error(errorMessage);
      }

      // Success case - clear everything
      this.sessionId = null;
      localStorage.removeItem('sessionId');
    } catch (error) {
      // Handle network errors
      const message = error instanceof Error ? error.message : 'Network error';
      throw error instanceof Error ? error : new Error(message);
    }
  }

  /**
   * Clear the current session
   */
  public async clearSession(address?: string): Promise<void> {
    if (address) {
      // Clear specific address session
      const sessionId = this.getSessionForAddress(address);
      if (sessionId) {
        this.sessionId = sessionId;
        await this.deleteSession();
        this.removeSessionForAddress(address);
      }
    } else {
      // Clear current session
      const sessionId = localStorage.getItem('sessionId');
      if (sessionId) {
        this.sessionId = sessionId;
        await this.deleteSession();
        localStorage.removeItem('sessionId');
      }
    }
  }

  /**
   * Set a session ID for testing purposes
   * @internal
   */
  setTestSessionId(sessionId: string | null) {
    this.sessionId = sessionId;
  }
}

// Export a singleton instance
export const smallocator = new SmallocatorClient();

// Export methods from the singleton instance
export const { submitCompact } = smallocator;
