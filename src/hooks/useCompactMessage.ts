import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { CompactMessage, CompactRequestPayload } from '../types/compact';
import { getAddress, keccak256, encodeAbiParameters, Hex } from 'viem';

const COMPACT_CONTRACT_ADDRESS = '0x00000000000018DF021Ff2467dF97ff846E09f48';

export interface AssembleMessageParams {
  inputTokenAmount: string;
  inputTokenAddress: string;
  outputTokenAddress: string;
  chainId: number;
  expirationTime: number; // Unix timestamp in seconds
  tribunal: string;
  mandate: Mandate;
}

export interface Mandate {
  recipient: string;
  expires: string;
  token: string;
  minimumAmount: string;
  baselinePriorityFee: string;
  scalingFactor: string;
  salt: Hex;
}

export function useCompactMessage() {
  const { address } = useAccount();

  return useMemo(
    () => ({
      assembleMessagePayload: ({
        inputTokenAmount,
        inputTokenAddress,
        outputTokenAddress,
        chainId,
        expirationTime,
        tribunal,
        mandate,
      }: AssembleMessageParams): CompactRequestPayload => {
        // Ensure all required fields are present
        if (
          !inputTokenAmount ||
          !inputTokenAddress ||
          !outputTokenAddress ||
          !chainId ||
          !expirationTime ||
          !tribunal ||
          !mandate ||
          !address
        ) {
          throw new Error('Missing required fields for compact message');
        }

        // Validate addresses
        try {
          getAddress(inputTokenAddress);
          getAddress(outputTokenAddress);
          getAddress(address);
          getAddress(tribunal);
          getAddress(mandate.token);
          getAddress(mandate.recipient);
        } catch {
          throw new Error('Invalid address format');
        }

        // Validate amounts are positive
        if (BigInt(inputTokenAmount) <= 0n) {
          throw new Error('Amount must be positive');
        }

        // Validate expiration time
        if (expirationTime <= Math.floor(Date.now() / 1000)) {
          throw new Error('Expiration time must be in the future');
        }

        // Compute the witness hash using the Mandate structure
        const witnessHash = keccak256(
          encodeAbiParameters(
            [
              { name: 'recipient', type: 'address' },
              { name: 'expires', type: 'uint256' },
              { name: 'token', type: 'address' },
              { name: 'minimumAmount', type: 'uint256' },
              { name: 'baselinePriorityFee', type: 'uint256' },
              { name: 'scalingFactor', type: 'uint256' },
              { name: 'salt', type: 'bytes32' }
            ],
            [
              mandate.recipient as Hex,
              BigInt(mandate.expires),
              mandate.token as Hex,
              BigInt(mandate.minimumAmount),
              BigInt(mandate.baselinePriorityFee),
              BigInt(mandate.scalingFactor),
              mandate.salt
            ]
          )
        );

        // Assemble the compact message
        const message: CompactMessage = {
          arbiter: COMPACT_CONTRACT_ADDRESS,
          sponsor: address,
          nonce: null,
          expires: expirationTime.toString(),
          id: witnessHash,
          amount: inputTokenAmount,
          mandate,
        };

        return {
          chainId: chainId.toString(),
          compact: message,
        };
      },
    }),
    [address]
  );
}
