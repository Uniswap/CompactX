import { useAccount, useReadContract, usePublicClient } from 'wagmi';
import { Address, erc20Abi } from 'viem';
import { useEffect, useState, useMemo } from 'react';

// The Compact contract address
const COMPACT_ADDRESS = '0x00000000000018DF021Ff2467dF97ff846E09f48';

/**
 * Hook to check if a token has sufficient approval for The Compact contract
 * Polls the RPC endpoint once per second when active
 */
export function useTokenApprovalCheck(
  tokenAddress: Address | undefined,
  requiredAmount: bigint | undefined,
  isActive: boolean = true
) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [hasSufficientApproval, setHasSufficientApproval] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Memoize allowance args to prevent unnecessary updates
  const allowanceArgs = useMemo(() => {
    if (!isConnected || !address || !tokenAddress) return undefined;
    return [address, COMPACT_ADDRESS] as const;
  }, [isConnected, address, tokenAddress]);

  // Get allowance from the token contract
  const { data: allowance, refetch } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: allowanceArgs,
    scopeKey: 'token-approval-check',
    query: {
      enabled: Boolean(tokenAddress && address && isConnected),
    },
  });

  // Check if the allowance is sufficient
  useEffect(() => {
    if (allowance !== undefined && requiredAmount !== undefined) {
      setHasSufficientApproval(allowance >= requiredAmount);
    }
  }, [allowance, requiredAmount]);

  // Set up polling when active
  useEffect(() => {
    if (!isActive || !tokenAddress || !isConnected || !requiredAmount) {
      return;
    }

    // Initial check
    checkApproval();

    // Set up polling interval
    const intervalId = setInterval(checkApproval, 1000);

    // Clean up interval on unmount or when dependencies change
    return () => clearInterval(intervalId);

    async function checkApproval() {
      if (!tokenAddress || !address || !publicClient) return;

      try {
        setIsLoading(true);
        // Refetch the allowance
        await refetch();
        setIsLoading(false);
      } catch (err) {
        console.error('Error checking token approval:', err);
        setError(err instanceof Error ? err : new Error('Failed to check token approval'));
        setIsLoading(false);
      }
    }
  }, [isActive, tokenAddress, address, requiredAmount, isConnected, publicClient, refetch]);

  return {
    hasSufficientApproval,
    isLoading,
    error,
    allowance,
  };
}
