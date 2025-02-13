import { useMemo } from 'react';
import { signTypedData } from '@wagmi/core';
import { CompactRequestPayload } from '../types/compact';
import { smallocator } from '../api/smallocator';
import { config } from '../config/wallet';
import { useChainId } from 'wagmi';
import {
  encodeAbiParameters,
  toBytes,
  keccak256,
  parseSignature,
  signatureToCompactSignature,
  serializeCompactSignature,
} from 'viem';

const WITNESS_TYPE_STRING =
  'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)';

const COMPACT_CONTRACT_ADDRESS = '0x00000000000018DF021Ff2467dF97ff846E09f48';

export interface CompactSignature {
  userSignature: `0x${string}`;
  smallocatorSignature: string;
  nonce: string;
}

export function useCompactSigner() {
  const chainId = useChainId();

  interface MandateHashInput {
    chainId: number | string;
    tribunal: string;
    recipient: string;
    expires: string;
    token: string;
    minimumAmount: string;
    baselinePriorityFee: string;
    scalingFactor: string;
    salt: string;
  }

  const deriveMandateHash = (mandate: MandateHashInput): `0x${string}` => {
    // Calculate MANDATE_TYPEHASH to match Solidity's EIP-712 typed data
    const MANDATE_TYPE_STRING =
      'Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)';
    const MANDATE_TYPEHASH = keccak256(toBytes(MANDATE_TYPE_STRING));

    // Debug mandate values
    console.log('Debug mandate values in deriveMandateHash:', {
      chainId: mandate.chainId,
      chainIdType: typeof mandate.chainId,
      tribunal: mandate.tribunal,
      tribunalType: typeof mandate.tribunal,
      recipient: mandate.recipient,
      recipientType: typeof mandate.recipient,
      expires: mandate.expires,
      expiresType: typeof mandate.expires,
      token: mandate.token,
      tokenType: typeof mandate.token,
      minimumAmount: mandate.minimumAmount,
      minimumAmountType: typeof mandate.minimumAmount,
      baselinePriorityFee: mandate.baselinePriorityFee,
      baselinePriorityFeeType: typeof mandate.baselinePriorityFee,
      scalingFactor: mandate.scalingFactor,
      scalingFactorType: typeof mandate.scalingFactor,
      salt: mandate.salt,
      saltType: typeof mandate.salt,
      fullMandate: mandate,
    });

    const encodedData = encodeAbiParameters(
      [
        { type: 'bytes32' }, // MANDATE_TYPEHASH
        { type: 'uint256' }, // block.chainid
        { type: 'address' }, // address(this)
        { type: 'address' }, // mandate.recipient
        { type: 'uint256' }, // mandate.expires
        { type: 'address' }, // mandate.token
        { type: 'uint256' }, // mandate.minimumAmount
        { type: 'uint256' }, // mandate.baselinePriorityFee
        { type: 'uint256' }, // mandate.scalingFactor
        { type: 'bytes32' }, // mandate.salt
      ],
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

    return keccak256(encodedData);
  };

  return useMemo(
    () => ({
      signCompact: async (
        request: CompactRequestPayload & { tribunal: string; currentChainId: string }
      ): Promise<CompactSignature> => {
        // Derive the witness hash from the mandate using the output chainId
        const witnessHash = deriveMandateHash({
          chainId: request.chainId, // Use output chainId for witness hash
          tribunal: request.tribunal,
          recipient: request.compact.mandate.recipient,
          expires: request.compact.mandate.expires,
          token: request.compact.mandate.token,
          minimumAmount: request.compact.mandate.minimumAmount,
          baselinePriorityFee: request.compact.mandate.baselinePriorityFee,
          scalingFactor: request.compact.mandate.scalingFactor,
          salt: request.compact.mandate.salt,
        });

        // Prepare the compact submission for Smallocator - only with witness information
        const smallocatorRequest = {
          chainId: request.currentChainId,
          compact: {
            arbiter: request.compact.arbiter,
            sponsor: request.compact.sponsor,
            nonce: request.compact.nonce,
            expires: request.compact.expires,
            id: request.compact.id,
            amount: request.compact.amount,
            witnessHash,
            witnessTypeString: WITNESS_TYPE_STRING,
          },
        };

        // First, get the smallocator signature
        const { signature: smallocatorSignature, nonce } =
          await smallocator.submitCompact(smallocatorRequest);

        // Log the smallocator response
        console.log('Smallocator response:', { signature: smallocatorSignature, nonce });

        // Create the EIP-712 payload using the current chainId
        const domain = {
          name: 'The Compact',
          version: '1',
          chainId: BigInt(request.currentChainId), // Use current chainId for EIP-712 domain
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
            chainId: BigInt(request.chainId), // Use output chainId
            tribunal: request.tribunal as `0x${string}`,
            recipient: request.compact.mandate.recipient as `0x${string}`,
            expires: BigInt(request.compact.mandate.expires),
            token: request.compact.mandate.token as `0x${string}`,
            minimumAmount: BigInt(request.compact.mandate.minimumAmount),
            baselinePriorityFee: BigInt(request.compact.mandate.baselinePriorityFee),
            scalingFactor: BigInt(request.compact.mandate.scalingFactor),
            salt: request.compact.mandate.salt,
          },
        } as const;

        // Define the EIP-712 types (unchanged)
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
            { name: 'chainId', type: 'uint256' }, // Add chainId field
            { name: 'tribunal', type: 'address' }, // Add tribunal field
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

        // Convert signatures to compact format using viem
        let compactedUserSignature = userSignature as `0x${string}`;
        if (userSignature.length === 132) {
          const parsedSig = parseSignature(userSignature);
          const compactSig = signatureToCompactSignature(parsedSig);
          compactedUserSignature = serializeCompactSignature(compactSig);
        }

        let compactedSmallocatorSignature = smallocatorSignature as `0x${string}`;
        if (smallocatorSignature.length === 132) {
          const parsedSig = parseSignature(smallocatorSignature as `0x${string}`);
          const compactSig = signatureToCompactSignature(parsedSig);
          compactedSmallocatorSignature = serializeCompactSignature(compactSig);
        }

        return {
          userSignature: compactedUserSignature,
          smallocatorSignature: compactedSmallocatorSignature,
          nonce,
        };
      },
    }),
    [chainId, deriveMandateHash]
  );
}
