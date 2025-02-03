import { useTokenBalances } from '../hooks/useTokenBalances';
import { useLockedTokenBalances } from '../hooks/useLockedTokenBalances';
import { formatUnits } from 'viem';

export function TokenBalances() {
  const {
    balances: directBalances,
    loading: directLoading,
    error: directError,
  } = useTokenBalances();
  const {
    balances: lockedBalances,
    isLoading: lockedLoading,
    error: lockedError,
  } = useLockedTokenBalances();

  if (directLoading || lockedLoading) {
    return <div>Loading balances...</div>;
  }

  if (directError || lockedError) {
    return <div>Error loading balances</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-2">Direct Balances</h2>
        {Object.entries(directBalances).map(([symbol, balance]) => (
          <div key={symbol} className="flex justify-between items-center py-2">
            <span>{symbol}</span>
            <span>{formatUnits(balance, 18)}</span>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Locked Balances</h2>
        {lockedBalances.map(token => (
          <div key={token.tokenAddress} className="mb-4">
            <div className="flex justify-between items-center py-2">
              <span>{token.symbol || 'Unknown Token'}</span>
              <span>{formatUnits(BigInt(token.totalBalance), token.decimals)}</span>
            </div>

            {token.chainBalances.map(chainBalance => (
              <div key={chainBalance.chainId} className="ml-4">
                <div className="text-sm text-gray-600">Chain {chainBalance.chainId}</div>
                {chainBalance.resourceLocks.map(lock => (
                  <div key={lock.lockId} className="ml-4 text-sm">
                    <div className="flex justify-between items-center py-1">
                      <div>
                        <span>{lock.name} </span>
                        <span
                          className={`text-xs ${lock.isLocked ? 'text-red-500' : 'text-green-500'}`}
                        >
                          ({lock.isLocked ? 'Locked' : 'Unlocked'})
                        </span>
                      </div>
                      <span>{formatUnits(BigInt(lock.balance), lock.decimals)}</span>
                    </div>
                    {lock.isLocked && (
                      <div className="text-xs text-gray-500">
                        Withdrawable at:{' '}
                        {new Date(Number(lock.withdrawableAt) * 1000).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
