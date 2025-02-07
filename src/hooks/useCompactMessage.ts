import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { CompactMessage, CompactRequestPayload } from '../types/compact';
import { getAddress, keccak256, encodeAbiParameters, Hex, toBytes, Address } from 'viem';

const ARBITERS: { [chainId: number]: string } = {
  1: '0x00000000000018DF021Ff2467dF97ff846E09f48',  // Ethereum
  10: '0x00000000000018DF021Ff2467dF97ff846E09f48', // Optimism
  8453: '0x00000000000018DF021Ff2467dF97ff846E09f48', // Base
};

export interface AssembleMessageParams {
  inputTokenAmount: string;
  inputTokenAddress: string;
  outputTokenAddress: string;
  chainId: number;
  expirationTime: number; // Unix timestamp in seconds
  tribunal: string;
  mandate: Mandate;
  quote: any; // Add quote to the params
}

export interface Mandate {
  recipient: string;
  expires: string;
  token: string;
  minimumAmount: string;
  baselinePriorityFee: string;
  scalingFactor: string;
  salt: Hex;
  chainId?: number;
  tribunal?: string;
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
        quote,
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
          !address ||
          !quote
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

        // Assemble the compact message
        const message: CompactMessage = {
          arbiter: ARBITERS[chainId],
          sponsor: address,
          nonce: null,
          expires: expirationTime.toString(),
          id: quote.data.id, // Use the ID from the quote
          amount: inputTokenAmount,
          mandate: {
            ...mandate,
            chainId,
            tribunal,
          },
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
