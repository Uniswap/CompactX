import { useState } from 'react';
import { broadcast } from '../api/broadcast';
import { CompactRequestPayload } from '../types/compact';
import { BroadcastRequest, BroadcastContext, Mandate } from '../types/broadcast';
import { message } from 'antd';
import { keccak256, encodeAbiParameters, toBytes } from 'viem';

export function useBroadcast() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deriveClaimHash = (
    arbiter: string,
    sponsor: string,
    nonce: string,
    expiration: string,
    id: string,
    amount: string,
    mandate: Mandate
  ): `0x${string}` => {
    // First derive the mandate hash
    const mandateHash = deriveMandateHash(mandate);

    // Calculate the COMPACT_TYPEHASH
    const COMPACT_TYPE_STRING =
      'Compact(address arbiter,address sponsor,uint256 nonce,uint256 expires,uint256 id,uint256 amount,Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)';
    const COMPACT_TYPEHASH = keccak256(toBytes(COMPACT_TYPE_STRING));

    // Encode all parameters including the derived mandate hash
    const encodedParameters = encodeAbiParameters(
      [
        { type: 'bytes32' }, // COMPACT_TYPEHASH
        { type: 'address' }, // arbiter
        { type: 'address' }, // sponsor
        { type: 'uint256' }, // nonce
        { type: 'uint256' }, // expires
        { type: 'uint256' }, // id
        { type: 'uint256' }, // amount
        { type: 'bytes32' }, // mandateHash
      ],
      [
        COMPACT_TYPEHASH,
        arbiter as `0x${string}`,
        sponsor as `0x${string}`,
        BigInt(nonce),
        BigInt(expiration),
        BigInt(id),
        BigInt(amount),
        mandateHash,
      ]
    );

    return keccak256(encodedParameters);
  };

  const deriveMandateHash = (mandate: Mandate): `0x${string}` => {
    const MANDATE_TYPE_STRING =
      'Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)';
    const MANDATE_TYPEHASH = keccak256(toBytes(MANDATE_TYPE_STRING));
    const encodedParameters = encodeAbiParameters(
      [
        'bytes32',
        'uint256',
        'address',
        'address',
        'uint256',
        'address',
        'uint256',
        'uint256',
        'uint256',
        'bytes32',
      ].map(type => ({ type })),
      [
        MANDATE_TYPEHASH,
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
      const mandateWithTribunal: Mandate = {
        ...payload.compact.mandate,
        // chainId and tribunal are already set correctly in the mandate
      };

      // Ensure we have a nonce before deriving the claim hash
      if (!payload.compact.nonce) {
        throw new Error('Nonce is required for deriving claim hash');
      }

      const claimHash = deriveClaimHash(
        payload.compact.arbiter,
        payload.compact.sponsor,
        payload.compact.nonce,
        payload.compact.expires,
        payload.compact.id,
        payload.compact.amount,
        mandateWithTribunal
      );

      const mandateHash = deriveMandateHash(mandateWithTribunal);

      const finalPayload: BroadcastRequest = {
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
          witnessHash: mandateHash,
          claimHash,
          witnessTypeString:
            'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
        },
      };

      const result = await broadcast.broadcast(finalPayload);

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
