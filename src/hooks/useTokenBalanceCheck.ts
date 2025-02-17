import { useContractRead, useAccount, useBalance } from 'wagmi';
import { Address, erc20Abi } from 'viem';

// The Compact contract address
const COMPACT_ADDRESS = '0x00000000000018DF021Ff2467dF97ff846E09f48';
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

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
  const { address, isConnected } = useAccount();

  console.log('useTokenBalanceCheck params:', {
    tokenAddress,
    compactId: compactId?.toString(),
    address,
    isConnected
  });

  // Get locked balance from The Compact
  const { data: lockedBalance, isError: lockedError } = useContractRead({
    address: COMPACT_ADDRESS,
    abi: compactAbi,
    functionName: 'balanceOf',
    args: isConnected && address && compactId ? [address, compactId] : undefined,
  });

  // Get ETH balance if token is null address, otherwise get ERC20 balance
  const { data: ethBalance } = useBalance({
    address: isConnected && address && tokenAddress === NULL_ADDRESS ? address : undefined,
  });

  const { data: erc20Balance, isError: erc20Error } = useContractRead({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: isConnected && address && tokenAddress && tokenAddress !== NULL_ADDRESS 
      ? [address] 
      : undefined,
  });

  // Use ETH balance for null address, ERC20 balance otherwise
  const unlockedBalance = tokenAddress === NULL_ADDRESS 
    ? ethBalance?.value 
    : erc20Balance;

  console.log('useTokenBalanceCheck results:', {
    lockedBalance: lockedBalance?.toString(),
    unlockedBalance: unlockedBalance?.toString(),
    error: lockedError || erc20Error
  });

  return {
    lockedBalance: isConnected ? lockedBalance : undefined,
    unlockedBalance: isConnected ? unlockedBalance : undefined,
    error: lockedError || erc20Error,
  };
}
