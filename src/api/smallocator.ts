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
  sessionId: string;
}

export interface SessionResponse {
  payload: SessionPayload;
}

export interface CompactRequest {
  chainId: string;
  compact: {
    amount: string;
    arbiter: string;
    expires: string;
    id: string;
    nonce: string;
    sponsor: string;
    witnessHash: string;
    witnessTypeString: string;
  };
}

export interface CompactResponse {
  success: boolean;
  txHash: string;
}

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
  async createSession(request: CreateSessionRequest): Promise<CreateSessionResponse> {
    const response = await this.request<CreateSessionResponse>('POST', '/session', request);
    // Store the session ID
    if (response.sessionId) {
      localStorage.setItem('sessionId', response.sessionId);
      this.sessionId = response.sessionId;
    }
    return response;
  }

  /**
   * Submit a compact message for signing by Smallocator
   * @param request - The compact message request
   */
  async submitCompact(request: CompactRequest): Promise<CompactResponse> {
    return this.request<CompactResponse>('POST', '/compact', request);
  }

  /**
   * Verify the current session
   */
  async verifySession(): Promise<{ valid: boolean }> {
    return this.request<{ valid: boolean }>('GET', '/session/verify');
  }
}

// Export a singleton instance
export const smallocator = new SmallocatorClient();
