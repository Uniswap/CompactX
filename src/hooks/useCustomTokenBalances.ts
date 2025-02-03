import { useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { erc20Abi } from 'viem';
import type { CustomToken } from './useCustomTokens';

export function useCustomTokenBalances(tokens: CustomToken[]) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!address || !publicClient || tokens.length === 0) {
      setBalances({});
      return;
    }

    const fetchBalances = async () => {
      setLoading(true);
      setError(null);

      try {
        const newBalances: Record<string, bigint> = {};

        await Promise.all(
          tokens.map(async token => {
            try {
              const balance = await publicClient.readContract({
                address: token.address as `0x${string}`,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [address],
              });

              newBalances[token.address] = balance as bigint;
            } catch (err) {
              console.error(`Failed to fetch balance for token ${token.address}:`, err);
            }
          })
        );

        setBalances(newBalances);
      } catch (err) {
        console.error('Failed to fetch custom token balances:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchBalances();
  }, [address, publicClient, tokens]);

  return { balances, loading, error };
}
