import { CompactRequest } from './smallocator';

export interface BroadcastRequest {
  finalPayload: {
    compact: CompactRequest;
    userSignature: string;
    smallocatorSignature: string;
    context?: Record<string, string>;
  };
}

export class BroadcastApiClient {
  private baseUrl: string;

  constructor() {
    const baseUrl = import.meta.env.VITE_BROADCAST_URL;
    if (!baseUrl) {
      throw new Error('VITE_BROADCAST_URL environment variable is not set');
    }
    this.baseUrl = baseUrl;
  }

  async broadcast(request: BroadcastRequest): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${this.baseUrl}/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to broadcast message');
      }

      return response.json();
    } catch {
      throw new Error('Failed to broadcast message');
    }
  }
}

// Export a singleton instance
export const broadcast = new BroadcastApiClient();
