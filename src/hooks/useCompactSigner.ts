import { useMemo } from 'react';
import { useSignTypedData } from 'wagmi';
import { CompactRequestPayload } from '../types/compact';
import { submitCompact } from '../api/smallocator';

export interface CompactSignature {
  userSignature: `0x${string}`;
  smallocatorSignature: string;
  nonce: string;
}

const COMPACT_CONTRACT_ADDRESS = '0x00000000000018DF021Ff2467dF97ff846E09f48';

export function useCompactSigner() {
  const { signTypedData } = useSignTypedData();

  return useMemo(
    () => ({
      signCompact: async (request: CompactRequestPayload): Promise<CompactSignature> => {
        // First, get the smallocator signature
        const { signature: smallocatorSignature, nonce } = await submitCompact(request);

        // Create the EIP-712 payload
        const domain = {
          name: 'The Compact',
          version: '1',
          chainId: BigInt(request.chainId),
          verifyingContract: COMPACT_CONTRACT_ADDRESS as `0x${string}`,
        } as const;

        // Convert string values to bigint for EIP-712 signing
        const message = {
          arbiter: request.compact.arbiter as `0x${string}`,
          sponsor: request.compact.sponsor as `0x${string}`,
          nonce: BigInt(nonce),
          expires: BigInt(request.compact.expires),
          id: request.compact.id as `0x${string}`,
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
          CompactMessage: [
            { name: 'arbiter', type: 'address' },
            { name: 'sponsor', type: 'address' },
            { name: 'nonce', type: 'uint256' },
            { name: 'expires', type: 'uint256' },
            { name: 'id', type: 'address' },
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
        const signature = (await signTypedData({
          domain,
          message,
          primaryType: 'CompactMessage',
          types,
        })) as unknown as `0x${string}`;

        return {
          userSignature: signature,
          smallocatorSignature,
          nonce,
        };
      },
    }),
    [signTypedData]
  );
}
