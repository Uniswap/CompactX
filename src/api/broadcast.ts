import axios, { AxiosError } from 'axios';
import { CompactMessage } from './smallocator';

export interface BroadcastRequest {
  finalPayload: {
    compact: CompactMessage;
    userSignature: string;
    smallocatorSignature: string;
  };
}

export interface BroadcastResponse {
  status: string;
  message: string;
}

interface ErrorResponse {
  message: string;
}

// API Client
export class BroadcastClient {
  private baseUrl: string;

  constructor() {
    const baseUrl = import.meta.env.VITE_BROADCAST_URL;
    if (!baseUrl) {
      throw new Error('VITE_BROADCAST_URL environment variable is not set');
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
          `Broadcast API error: ${axiosError.response?.data?.message || axiosError.message}`
        );
      }
      throw new Error(`Broadcast API error: ${(error as Error).message}`);
    }
  }

  /**
   * Broadcast the final signed compact message
   * @param request - The final payload with all signatures
   */
  async broadcast(request: BroadcastRequest): Promise<BroadcastResponse> {
    return this.request<BroadcastResponse>('POST', '/broadcast', request);
  }
}

// Export a singleton instance
export const broadcast = new BroadcastClient();
