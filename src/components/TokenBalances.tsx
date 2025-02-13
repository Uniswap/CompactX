import { useTokenBalances } from '../hooks/useTokenBalances';
import { useLockedTokenBalances } from '../hooks/useLockedTokenBalances';
import { useCustomTokens } from '../hooks/useCustomTokens';
import { useCustomTokenBalances } from '../hooks/useCustomTokenBalances';
import { formatUnits } from 'viem';
import { useChainId } from 'wagmi';
import { AddCustomToken } from './AddCustomToken';

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
  const chainId = useChainId();
  const { getCustomTokens, removeCustomToken } = useCustomTokens();

  const customTokens = chainId ? getCustomTokens(chainId) : [];
  const {
    balances: customBalances,
    loading: customLoading,
    error: customError,
  } = useCustomTokenBalances(customTokens);

  if (directLoading || lockedLoading || customLoading) {
    return <div>Loading balances...</div>;
  }

  if (directError || lockedError || customError) {
    return <div>Error loading balances</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Token Balances</h1>
        <AddCustomToken />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Direct Balances</h2>
        {Object.entries(directBalances).map(([symbol, balance]) => (
          <div key={symbol} className="flex justify-between items-center py-2">
            <span>{symbol}</span>
            <span>{formatUnits(balance, 18)}</span>
          </div>
        ))}

        {/* Custom Tokens Section */}
        {customTokens.length > 0 && (
          <div className="mt-4">
            <h3 className="text-md font-semibold mb-2">Custom Tokens</h3>
            {customTokens.map(token => (
              <div key={token.address} className="flex justify-between items-center py-2">
                <div className="flex items-center">
                  {token.logoURI && (
                    <img
                      src={token.logoURI}
                      alt={token.symbol}
                      className="w-6 h-6 mr-2 rounded-full"
                    />
                  )}
                  <div>
                    <span className="font-medium">{token.symbol}</span>
                    <span className="text-sm text-gray-500 ml-2">{token.name}</span>
                  </div>
                </div>
                <div className="flex items-center">
                  <span className="mr-4">
                    {customBalances[token.address] ? (
                      formatUnits(customBalances[token.address], token.decimals)
                    ) : (
                      <div className="animate-spin h-4 w-4">
                        <svg className="text-gray-500" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    )}
                  </span>
                  <button
                    onClick={() => removeCustomToken(token.chainId, token.address)}
                    className="p-2 text-red-500 hover:text-red-700 rounded-full hover:bg-red-500/10 transition-colors group relative"
                    title="Remove token"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      Remove token
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
