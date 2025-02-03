import axios, { AxiosError } from 'axios';

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

export interface SessionResponse {
  payload: SessionPayload;
}

export interface CreateSessionRequest {
  signature: string;
  payload: SessionPayload;
}

export interface CreateSessionResponse {
  sessionId: string;
}

export interface CompactMessage {
  arbiter: string;
  sponsor: string;
  nonce: string;
  expires: string;
  id: string;
  amount: string;
  witnessTypeString: string;
  witnessHash: string;
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

interface ErrorResponse {
  message: string;
}

// API Client
export class SmallocatorClient {
  private baseUrl: string;

  constructor() {
    const baseUrl = import.meta.env.VITE_SMALLOCATOR_URL;
    if (!baseUrl) {
      throw new Error('VITE_SMALLOCATOR_URL environment variable is not set');
    }
    this.baseUrl = baseUrl;
  }

  private async request<T>(method: 'GET' | 'POST', endpoint: string, data?: unknown): Promise<T> {
    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${endpoint}`,
        data,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ErrorResponse>;
        throw new Error(
          `Smallocator API error: ${axiosError.response?.data?.message || axiosError.message}`
        );
      }
      throw new Error(`Smallocator API error: ${(error as Error).message}`);
    }
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
    return this.request<CreateSessionResponse>('POST', '/session', request);
  }

  /**
   * Submit a compact message for signing by Smallocator
   * @param request - The compact message request
   */
  async submitCompact(request: CompactRequest): Promise<CompactResponse> {
    return this.request<CompactResponse>('POST', '/compact', request);
  }
}

// Export a singleton instance
export const smallocator = new SmallocatorClient();
