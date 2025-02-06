import { useState } from 'react';
import { broadcast } from '../api/broadcast';
import { CompactRequestPayload } from '../types/compact';
import { BroadcastRequest, BroadcastContext, BroadcastMandate } from '../types/broadcast';
import { message } from 'antd';
import { keccak256, encodePacked } from 'viem';

export function useBroadcast() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deriveMandateHash = (mandate: BroadcastMandate): `0x${string}` => {
    const encodedParameters = encodePacked(
      ['uint256', 'address', 'address', 'uint256', 'address', 'uint256', 'uint256', 'uint256', 'bytes32'],
      [
        BigInt(mandate.chainId),
        mandate.tribunal as `0x${string}`,
        mandate.recipient as `0x${string}`,
        BigInt(parseInt(mandate.expires)),
        mandate.token as `0x${string}`,
        BigInt(mandate.minimumAmount),
        BigInt(mandate.baselinePriorityFee),
        BigInt(mandate.scalingFactor),
        mandate.salt as `0x${string}`,
      ]
    );

    return keccak256(encodedParameters);
  };

  const broadcastTx = async (
    payload: CompactRequestPayload,
    sponsorSignature: string,
    allocatorSignature: string,
    context: BroadcastContext
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const mandateWithTribunal: BroadcastMandate = {
        ...payload.compact.mandate,
        chainId: Number(payload.chainId),
        tribunal: (payload.compact.mandate as unknown as { tribunal: string }).tribunal,
      };

      const witnessHash = deriveMandateHash(mandateWithTribunal);

      const finalPayload: BroadcastRequest['finalPayload'] = {
        chainId: payload.chainId,
        compact: {
          ...payload.compact,
          mandate: mandateWithTribunal,
        },
        sponsorSignature,
        allocatorSignature,
        context: {
          dispensation: context.dispensation,
          dispensationUSD: context.dispensationUSD,
          spotOutputAmount: context.spotOutputAmount,
          quoteOutputAmountDirect: context.quoteOutputAmountDirect,
          quoteOutputAmountNet: context.quoteOutputAmountNet,
          deltaAmount: context.deltaAmount,
          witnessHash,
          witnessTypeString: 'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
        },
      };

      const result = await broadcast.broadcast({ finalPayload });

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
    broadcast: broadcastTx,
    isLoading,
    error,
  };
}
