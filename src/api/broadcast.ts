import { BroadcastRequest } from '../types/broadcast';

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
    const response = await fetch(`${this.baseUrl}/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Broadcast failed: ${response.statusText}`);
    }

    return await response.json();
  }
}

// Export a singleton instance
export const broadcast = new BroadcastApiClient();
