import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { CompactMessage, CompactRequestPayload, EIP712Payload } from '../types/compact';
import { getAddress, keccak256 } from 'viem';

const COMPACT_CONTRACT_ADDRESS = '0x00000000000018DF021Ff2467dF97ff846E09f48';

export interface AssembleMessageParams {
  arbiter: string;
  inputTokenAmount: string;
  inputTokenAddress: string;
  outputTokenAddress: string;
  chainId: number;
  expirationTime: number; // Unix timestamp in seconds
}

export function useCompactMessage() {
  const { address } = useAccount();

  const assembleMessagePayload = useMemo(
    () =>
      ({
        arbiter,
        inputTokenAmount,
        inputTokenAddress,
        outputTokenAddress,
        chainId,
        expirationTime,
      }: AssembleMessageParams): CompactRequestPayload => {
        // Ensure all required fields are present
        if (
          !arbiter ||
          !inputTokenAmount ||
          !inputTokenAddress ||
          !outputTokenAddress ||
          !chainId ||
          !expirationTime ||
          !address
        ) {
          throw new Error('Missing required fields for compact message');
        }

        // Validate addresses (basic check for non-empty and correct length)
        try {
          getAddress(arbiter); // Checksum validation
          getAddress(inputTokenAddress);
          getAddress(outputTokenAddress);
          getAddress(address);
        } catch {
          throw new Error('Invalid address format');
        }

        // Validate amount is non-negative
        if (BigInt(inputTokenAmount) <= 0n) {
          throw new Error('Input amount must be positive');
        }

        // Validate expiration is in the future
        if (expirationTime <= Math.floor(Date.now() / 1000)) {
          throw new Error('Expiration time must be in the future');
        }

        // Compute the witness hash
        // witnessTypeString format: "ExampleWitness(uint256 foo,bytes32 bar)"
        const witnessTypeString = 'CrossChainSwap(address inputToken,address outputToken)';
        const encodedInputToken = inputTokenAddress.toLowerCase().padStart(64, '0');
        const encodedOutputToken = outputTokenAddress.toLowerCase().padStart(64, '0');
        const witnessHash = keccak256(`0x${encodedInputToken}${encodedOutputToken}`);

        // Assemble the compact message
        const message: CompactMessage = {
          arbiter,
          sponsor: address,
          nonce: '', // This will be provided by the smallocator
          expires: expirationTime.toString(),
          id: inputTokenAddress, // Using input token address as the resource ID
          amount: inputTokenAmount,
          witnessTypeString,
          witnessHash,
        };

        return {
          chainId: chainId.toString(),
          compact: message,
        };
      },
    [address]
  );

  const createEIP712Payload = useMemo(
    () =>
      (message: CompactMessage, smallocatorSignature: string, chainId: number): EIP712Payload => {
        return {
          domain: {
            name: 'The Compact',
            version: '1',
            chainId,
            verifyingContract: COMPACT_CONTRACT_ADDRESS,
          },
          message: {
            ...message,
            smallocatorSignature,
          },
          primaryType: 'Compact',
          types: {
            EIP712Domain: [
              { name: 'name', type: 'string' },
              { name: 'version', type: 'string' },
              { name: 'chainId', type: 'uint256' },
              { name: 'verifyingContract', type: 'address' },
            ],
            Compact: [
              { name: 'arbiter', type: 'address' },
              { name: 'sponsor', type: 'address' },
              { name: 'nonce', type: 'bytes32' },
              { name: 'expires', type: 'uint256' },
              { name: 'id', type: 'address' },
              { name: 'amount', type: 'uint256' },
              { name: 'witnessTypeString', type: 'string' },
              { name: 'witnessHash', type: 'bytes32' },
              { name: 'smallocatorSignature', type: 'bytes' },
            ],
          },
        };
      },
    []
  );

  return {
    assembleMessagePayload,
    createEIP712Payload,
  };
}
