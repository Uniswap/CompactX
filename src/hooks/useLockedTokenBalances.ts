import { useAccount } from 'wagmi';
import { useLockedBalances } from '../api/graphql';

export interface ResourceLockDisplay {
  allocatorAddress: string;
  balance: string;
  isMultichain: boolean;
  isActive: boolean;
  isLocked: boolean;
  lockId: string;
  name: string;
  symbol: string;
  decimals: number;
  resetPeriod: number;
  withdrawalStatus: number;
  withdrawableAt: string;
}

export interface ChainBalance {
  chainId: string;
  balance: string;
  resourceLocks: ResourceLockDisplay[];
}

export interface AggregatedTokenBalance {
  tokenAddress: string;
  isNative: boolean;
  name: string | null;
  symbol: string | null;
  decimals: number;
  totalBalance: string;
  chainBalances: ChainBalance[];
}

export function useLockedTokenBalances() {
  const { address } = useAccount();
  const { data, isLoading, error } = useLockedBalances(address);

  const aggregatedBalances = data?.account.tokenBalances.items.reduce<
    Record<string, AggregatedTokenBalance>
  >((acc, item) => {
    const tokenAddress = item.token.tokenAddress.toLowerCase();
    const isNative = tokenAddress === '0x0000000000000000000000000000000000000000';

    // Use token-level metadata from the token object
    const name = item.token.name;
    const symbol = item.token.symbol;
    const decimals = item.token.decimals;

    if (!acc[tokenAddress]) {
      acc[tokenAddress] = {
        tokenAddress,
        isNative,
        name,
        symbol,
        decimals,
        totalBalance: '0',
        chainBalances: [],
      };
    }

    // Add to total balance
    acc[tokenAddress].totalBalance = (
      BigInt(acc[tokenAddress].totalBalance) + BigInt(item.aggregateBalance)
    ).toString();

    // Add chain-specific balance
    acc[tokenAddress].chainBalances.push({
      chainId: item.token.chainId.toString(),
      balance: item.aggregateBalance,
      resourceLocks: item.resourceLocks.items.map(lock => {
        const now = Date.now();
        const withdrawableAt = Number(lock.withdrawableAt || '0') * 1000; // Convert to milliseconds
        const isLocked = withdrawableAt > now;

        return {
          allocatorAddress: lock.resourceLock.allocator.account,
          balance: lock.balance,
          isMultichain: lock.resourceLock.isMultichain,
          isActive: true,
          isLocked,
          lockId: lock.resourceLock.lockId,
          name: lock.resourceLock.name,
          symbol: lock.resourceLock.symbol,
          decimals: lock.resourceLock.decimals,
          resetPeriod: lock.resourceLock.resetPeriod,
          withdrawalStatus: Number(lock.withdrawalStatus || 0),
          withdrawableAt: lock.withdrawableAt || '0',
        };
      }),
    });

    return acc;
  }, {});

  const sortedBalances = aggregatedBalances
    ? Object.values(aggregatedBalances).sort((a, b) => {
        const aBalance = BigInt(a.totalBalance);
        const bBalance = BigInt(b.totalBalance);
        return aBalance > bBalance ? -1 : aBalance < bBalance ? 1 : 0;
      })
    : [];

  return {
    balances: sortedBalances,
    isLoading,
    error,
  };
}
