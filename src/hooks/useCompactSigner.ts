import { useAccount, useSignTypedData, useChainId } from 'wagmi';
import { CompactMessage } from '../types/compact';
import * as smallocator from '../api/smallocator';
import { Address, TypedDataDomain } from 'viem';

export interface CompactSignature {
  userSignature: string;
  smallocatorSignature: string;
  nonce: string;
}

const COMPACT_CONTRACT_ADDRESS = '0x00000000000018DF021Ff2467dF97ff846E09f48' as const;

export function useCompactSigner() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { signTypedData } = useSignTypedData();

  const signCompact = async (
    compactMessage: CompactMessage
  ): Promise<CompactSignature> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    // 1. Get the smallocator signature
    const { signature: smallocatorSignature, nonce } = await smallocator.submitCompact({
      chainId: chainId.toString(),
      compact: {
        ...compactMessage,
      },
    });

    // 2. Prepare EIP-712 domain and types
    const domain: TypedDataDomain = {
      name: 'The Compact',
      version: '1',
      chainId,
      verifyingContract: COMPACT_CONTRACT_ADDRESS,
    };

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
        { name: 'id', type: 'bytes32' },
        { name: 'amount', type: 'uint256' },
        { name: 'mandate', type: 'Mandate' },
      ],
      Mandate: [
        { name: 'chainId', type: 'uint256' },
        { name: 'tribunal', type: 'address' },
        { name: 'recipient', type: 'address' },
        { name: 'expires', type: 'uint256' },
        { name: 'token', type: 'address' },
        { name: 'minimumAmount', type: 'uint256' },
        { name: 'baselinePriorityFee', type: 'uint256' },
        { name: 'scalingFactor', type: 'uint256' },
        { name: 'salt', type: 'bytes32' },
      ],
    } as const;

    // 3. Get user signature
    const userSignature = await signTypedData({
      domain,
      message: {
        ...compactMessage,
      },
      primaryType: 'Compact',
      types,
    });

    return {
      userSignature,
      smallocatorSignature,
      nonce,
    };
  };

  return {
    signCompact,
  };
}
