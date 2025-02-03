import { useTokenBalances } from '../hooks/useTokenBalances';
import { useLockedTokenBalances } from '../hooks/useLockedTokenBalances';
import { useCustomTokens } from '../hooks/useCustomTokens';
import { useCustomTokenBalances } from '../hooks/useCustomTokenBalances';
import { formatUnits } from 'viem';
import { useChainId } from 'wagmi';
import { AddCustomToken } from './AddCustomToken';
import { Button, Tooltip, Spin } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

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
                      <Spin size="small" />
                    )}
                  </span>
                  <Tooltip title="Remove token">
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => removeCustomToken(token.chainId, token.address)}
                      className="text-red-500 hover:text-red-700"
                    />
                  </Tooltip>
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
