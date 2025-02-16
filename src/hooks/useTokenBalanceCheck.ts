import { useContractRead, useAccount } from 'wagmi';
import { Address, erc20Abi } from 'viem';

// The Compact contract address
const COMPACT_ADDRESS = '0x00000000000018DF021Ff2467dF97ff846E09f48';

// Minimal ABI for The Compact balanceOf function
const compactAbi = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'id', type: 'uint256' },
    ],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export function useTokenBalanceCheck(
  tokenAddress: Address | undefined,
  compactId: bigint | undefined
) {
  const { address } = useAccount();

  // Get locked balance from The Compact
  const { data: lockedBalance, isError: lockedError } = useContractRead({
    address: COMPACT_ADDRESS,
    abi: compactAbi,
    functionName: 'balanceOf',
    args: address && compactId ? [address, compactId] : undefined,
  });

  // Get unlocked balance from the input token
  const { data: unlockedBalance, isError: unlockedError } = useContractRead({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address && tokenAddress ? [address] : undefined,
  });

  return {
    lockedBalance,
    unlockedBalance,
    error: lockedError || unlockedError,
  };
}
