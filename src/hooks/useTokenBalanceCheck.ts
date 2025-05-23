import { useAccount, useBalance, useReadContract, useChainId } from 'wagmi';
import { Address, erc20Abi } from 'viem';
import { useMemo, useEffect, useState } from 'react';
import { smallocator } from '../api/smallocator';
import { autocator } from '../api/autocator';
import { useAllocator } from './useAllocator';

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
  const chainId = useChainId();

  // Memoize contract read arguments to prevent unnecessary updates
  const lockedBalanceArgs = useMemo(() => {
    if (!isConnected || !address || !compactId) return undefined;
    return [address, compactId] as const;
  }, [isConnected, address, compactId]);

  const erc20BalanceArgs = useMemo(() => {
    if (!isConnected || !address || !tokenAddress || tokenAddress === NULL_ADDRESS)
      return undefined;
    return [address] as const;
  }, [isConnected, address, tokenAddress]);

  // Get locked balance from The Compact
  const { data: lockedBalance, error: lockedError } = useReadContract({
    address: COMPACT_ADDRESS,
    abi: compactAbi,
    functionName: 'balanceOf',
    args: lockedBalanceArgs,
    scopeKey: 'locked-balance',
  });

  // Get ETH balance if token is null address, otherwise get ERC20 balance
  const { data: ethBalance } = useBalance({
    address: isConnected && address && tokenAddress === NULL_ADDRESS ? address : undefined,
  });

  const { data: erc20Balance, error: erc20Error } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: erc20BalanceArgs,
    scopeKey: 'erc20-balance',
  });

  // Use ETH balance for null address, ERC20 balance otherwise
  const unlockedBalance = useMemo(
    () => (tokenAddress === NULL_ADDRESS ? ethBalance?.value : erc20Balance),
    [tokenAddress, ethBalance?.value, erc20Balance]
  );

  const [allocatorBalance, setAllocatorBalance] = useState<bigint>();
  const { selectedAllocator } = useAllocator();

  useEffect(() => {
    async function fetchAllocatorBalance() {
      if (!isConnected || !compactId || !chainId || !address) return;

      try {
        // Get the balance from the appropriate allocator
        const balance =
          selectedAllocator === 'SMALLOCATOR'
            ? await smallocator.getResourceLockBalance(chainId.toString(), compactId.toString())
            : await autocator.getResourceLockBalance(
                chainId.toString(),
                compactId.toString(),
                address
              );

        setAllocatorBalance(BigInt(balance.balanceAvailableToAllocate));
      } catch (error) {
        console.error(`Error fetching ${selectedAllocator.toLowerCase()} balance:`, error);
        setAllocatorBalance(BigInt(0));
      }
    }

    fetchAllocatorBalance();
  }, [isConnected, compactId, chainId, selectedAllocator, address]);

  return {
    lockedBalance: isConnected ? allocatorBalance : undefined,
    lockedIncludingAllocated: isConnected ? lockedBalance : undefined,
    unlockedBalance: isConnected ? unlockedBalance : undefined,
    error: Boolean(lockedError || erc20Error),
  };
}
