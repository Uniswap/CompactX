import { useAccount, useBalance } from 'wagmi';
import { useState, useEffect } from 'react';

export interface Token {
  address: `0x${string}`;
  symbol: string;
  decimals: number;
}

export function useTokenBalances() {
  const { address: account } = useAccount();
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [loading] = useState(false);
  const [error] = useState<Error | null>(null);

  // Get native token balance
  const { data: nativeBalance } = useBalance({
    address: account,
  });

  useEffect(() => {
    if (!account) {
      setBalances({});
      return;
    }

    // Add native token balance
    if (nativeBalance) {
      setBalances(prev => ({ ...prev, native: nativeBalance.value }));
    }
  }, [account, nativeBalance]);

  return {
    balances,
    loading,
    error,
  };
}
