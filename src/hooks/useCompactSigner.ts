import { useMemo } from 'react';
import { signTypedData } from '@wagmi/core';
import { CompactRequestPayload } from '../types/compact';
import { smallocator } from '../api/smallocator';
import { config } from '../config/wallet';
import { useChainId } from 'wagmi';

export interface CompactSignature {
  userSignature: `0x${string}`;
  smallocatorSignature: string;
  nonce: string;
}

const COMPACT_CONTRACT_ADDRESS = '0x00000000000018DF021Ff2467dF97ff846E09f48';

export function useCompactSigner() {
  const chainId = useChainId();

  return useMemo(
    () => ({
      signCompact: async (request: CompactRequestPayload): Promise<CompactSignature> => {
        // First, get the smallocator signature
        const { signature: smallocatorSignature, nonce } = await smallocator.submitCompact(request);
        
        // Log the smallocator response
        console.log('Smallocator response:', { signature: smallocatorSignature, nonce });

        // Create the EIP-712 payload
        const domain = {
          name: 'The Compact',
          version: '1',
          chainId: BigInt(chainId), // Use current chain ID instead of mandate chain ID
          verifyingContract: COMPACT_CONTRACT_ADDRESS as `0x${string}`,
        } as const;

        // Convert string values to bigint for EIP-712 signing
        const message = {
          arbiter: request.compact.arbiter as `0x${string}`,
          sponsor: request.compact.sponsor as `0x${string}`,
          nonce: BigInt(nonce),
          expires: BigInt(request.compact.expires),
          id: BigInt(request.compact.id),
          amount: BigInt(request.compact.amount),
          mandate: {
            recipient: request.compact.mandate.recipient as `0x${string}`,
            expires: BigInt(request.compact.mandate.expires),
            token: request.compact.mandate.token as `0x${string}`,
            minimumAmount: BigInt(request.compact.mandate.minimumAmount),
            baselinePriorityFee: BigInt(request.compact.mandate.baselinePriorityFee),
            scalingFactor: BigInt(request.compact.mandate.scalingFactor),
            salt: request.compact.mandate.salt,
          },
        } as const;

        // Define the EIP-712 types
        const types = {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Compact: [
            { name: 'arbiter', type: 'address' },
            { name: 'sponsor', type: 'address' },
            { name: 'nonce', type: 'uint256' },
            { name: 'expires', type: 'uint256' },
            { name: 'id', type: 'uint256' },
            { name: 'amount', type: 'uint256' },
            { name: 'mandate', type: 'Mandate' },
          ],
          Mandate: [
            { name: 'recipient', type: 'address' },
            { name: 'expires', type: 'uint256' },
            { name: 'token', type: 'address' },
            { name: 'minimumAmount', type: 'uint256' },
            { name: 'baselinePriorityFee', type: 'uint256' },
            { name: 'scalingFactor', type: 'uint256' },
            { name: 'salt', type: 'bytes32' },
          ],
        } as const;

        // Sign the message
        const userSignature = await signTypedData(config, {
          domain,
          message,
          primaryType: 'Compact',
          types,
        });

        if (!userSignature) {
          throw new Error('Failed to get user signature');
        }

        return {
          userSignature: userSignature as `0x${string}`,
          smallocatorSignature,
          nonce,
        };
      },
    }),
    [chainId]
  );
}
