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

export interface Mandate {
  recipient: string;
  expires: string;
  token: string;
  minimumAmount: string;
  baselinePriorityFee: string;
  scalingFactor: string;
  salt: `0x${string}`;
}

export interface CompactMessage {
  arbiter: string;
  sponsor: string;
  nonce: string | null;
  expires: string;
  id: string;
  amount: string;
  mandate: Mandate;
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
export const isCompactRequest = (data: unknown): data is CompactRequest => {
  if (!data || typeof data !== 'object') return false;
  const request = data as CompactRequest;

  if (typeof request.chainId !== 'string' || !request.compact) return false;

  const compact = request.compact;
  return (
    typeof compact.arbiter === 'string' &&
    typeof compact.sponsor === 'string' &&
    (compact.nonce === null || typeof compact.nonce === 'string') &&
    typeof compact.expires === 'string' &&
    typeof compact.id === 'string' &&
    typeof compact.amount === 'string' &&
    typeof compact.mandate.recipient === 'string' &&
    typeof compact.mandate.expires === 'string' &&
    typeof compact.mandate.token === 'string' &&
    typeof compact.mandate.minimumAmount === 'string' &&
    typeof compact.mandate.baselinePriorityFee === 'string' &&
    typeof compact.mandate.scalingFactor === 'string' &&
    typeof compact.mandate.salt === 'string'
  );
};

// API Client
export class SmallocatorClient {
  private baseUrl: string;
  private sessionId: string | null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || import.meta.env.VITE_SMALLOCATOR_URL;
    if (!this.baseUrl) {
      throw new Error('VITE_SMALLOCATOR_URL environment variable is not set');
    }
    this.sessionId = localStorage.getItem('sessionId');
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

    let response;
    try {
      response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
      });
    } catch (error) {
      // Handle network errors
      const message = error instanceof Error ? error.message : 'Network error';
      console.error('Request failed:', message);
      throw new Error(message);
    }

    // Now we know we have a response
    let result;
    try {
      result = await response.json();
    } catch (error) {
      // Response is not JSON
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      // For DELETE requests, empty response is OK
      if (method === 'DELETE' && response.ok) {
        return {} as T;
      }
      const message = error instanceof Error ? error.message : 'Invalid Response Format';
      throw new Error(message);
    }

    console.log('Got response:', {
      ok: response.ok,
      status: response.status,
      result,
    });

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
    // Store the session ID
    if (response.session.id) {
      localStorage.setItem('sessionId', response.session.id);
      this.sessionId = response.session.id;
    }
    return { sessionId: response.session.id };
  }

  /**
   * Submit a compact message for signing by Smallocator
   * @param request - The compact message request
   */
  async submitCompact(request: CompactRequest): Promise<CompactResponse> {
    if (!isCompactRequest(request)) {
      throw new Error('Invalid compact request format');
    }

    const response = await this.request<CompactResponse>('POST', '/compact', request);

    if (!isCompactResponse(response)) {
      throw new Error('Invalid compact response format');
    }

    return response;
  }

  /**
   * Verify the current session
   * @returns Object with valid status and optional error message
   */
  async verifySession(): Promise<{
    valid: boolean;
    error?: string;
    session?: SessionVerifyResponse['session'];
  }> {
    if (!this.sessionId) {
      return { valid: false, error: 'No session found' };
    }

    try {
      const response = await this.request<SessionVerifyResponse>('GET', '/session');

      // If we get a successful response, the session is valid
      return { valid: true, session: response.session };
    } catch (error) {
      // Clear session if it's invalid or expired
      if (
        error instanceof Error &&
        (error.message.includes('Invalid session') || error.message.includes('expired'))
      ) {
        this.clearSession();
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
        let errorMessage = `Server error (${response.status})`;
        try {
          const result = await response.json();
          if (result.error) {
            errorMessage = result.error;
          }
        } catch {
          // If we can't parse the error, use the default message
        }
        console.error('Server error during session deletion:', errorMessage);
        throw new Error(errorMessage);
      }

      // Success case - clear everything
      this.sessionId = null;
      localStorage.removeItem('sessionId');
    } catch (error) {
      // Handle network errors
      const message = error instanceof Error ? error.message : 'Network error';
      console.error('Network error during session deletion:', message);
      throw error instanceof Error ? error : new Error(message);
    }
  }

  /**
   * Clear the current session
   */
  public async clearSession(): Promise<void> {
    try {
      await this.deleteSession();
    } catch (error) {
      console.error('Failed to clear session:', error);
      throw error;
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
