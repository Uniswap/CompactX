import { useState } from 'react';
import { BroadcastApiClient } from '../api/broadcast';
import { CompactRequestPayload } from '../types/compact';
import { BroadcastRequest, BroadcastContext } from '../types/broadcast';
import { message } from 'antd';

export function useBroadcast() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const broadcastClient = new BroadcastApiClient();

  const broadcast = async (
    payload: CompactRequestPayload,
    sponsorSignature: string,
    allocatorSignature: string,
    context: BroadcastContext
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const finalPayload: BroadcastRequest['finalPayload'] = {
        chainId: payload.chainId,
        compact: {
          ...payload.compact,
          mandate: {
            ...payload.compact.mandate,
            chainId: Number(payload.chainId), // Ensure chainId is a number
          }
        },
        sponsorSignature,
        allocatorSignature,
        context,
      };

      const result = await broadcastClient.broadcast({ finalPayload });

      if (result.success) {
        message.success('Transaction broadcast successfully');
        return result;
      } else {
        throw new Error('Failed to broadcast transaction');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to broadcast transaction';
      message.error(errorMessage);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    broadcast,
    isLoading,
    error,
  };
}
