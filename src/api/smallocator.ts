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

export interface ErrorResponse {
  error: string;
}

// API Client
export class SmallocatorClient {
  private baseUrl: string;
  private sessionId: string | null;

  constructor() {
    const baseUrl = import.meta.env.VITE_SMALLOCATOR_URL;
    if (!baseUrl) {
      throw new Error('VITE_SMALLOCATOR_URL environment variable is not set');
    }
    this.baseUrl = baseUrl;
    this.sessionId = localStorage.getItem('sessionId');
  }

  protected async request<T>(method: 'GET' | 'POST', endpoint: string, data?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add session header if available
    if (this.sessionId) {
      headers['x-session-id'] = this.sessionId;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Request failed');
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
   */
  async verifySession(): Promise<{ valid: boolean }> {
    if (!this.sessionId) {
      return { valid: false };
    }

    try {
      const response = await fetch(`${this.baseUrl}/session/verify`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': this.sessionId,
        },
      });

      return { valid: response.ok };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Set a session ID for testing purposes
   * @internal
   */
  setTestSessionId(sessionId: string | null) {
    this.sessionId = sessionId;
  }

  /**
   * Clear the current session
   */
  clearSession() {
    this.sessionId = null;
    localStorage.removeItem('sessionId');
  }
}

// Export a singleton instance
export const smallocator = new SmallocatorClient();

// Export methods from the singleton instance
export const { submitCompact } = smallocator;
