import { Select } from './Select';
import { NumberInput } from './NumberInput';
import { Modal } from './Modal';
import { SegmentedControl } from './SegmentedControl';
import { TooltipIcon } from './TooltipIcon';
import { ConnectButton } from '../config/wallet';
import { ResetPeriod, SUPPORTED_CHAINS, INPUT_CHAINS } from '../utils/tradeUtils';
import type { TradeFormValues } from '../utils/tradeUtils';
import { parseUnits } from 'viem';
import type { CalibratorQuoteResponse, Token } from '../types/index';
import { formatTokenAmount } from '../utils/tradeUtils';

interface TradeFormUIProps {
  isConnected: boolean;
  isAuthenticated: boolean;
  isApproving: boolean;
  isDepositing: boolean;
  isWaitingForFinalization: boolean;
  isSigning: boolean;
  isExecutingSwap: boolean;
  isLoading: boolean;
  chainId: number;
  selectedInputChain: number;
  selectedOutputChain: number;
  selectedInputAmount: string;
  selectedInputToken: Token | undefined;
  selectedOutputToken: Token | undefined;
  formValues: Partial<TradeFormValues>;
  quote: CalibratorQuoteResponse | undefined;
  error: Error | null;
  errorMessage: string;
  statusMessage: string;
  settingsVisible: boolean;
  ethereumOutputModalVisible: boolean;
  depositModalVisible: boolean;
  needsApproval: boolean;
  lockedBalance: bigint | undefined;
  lockedIncludingAllocated: bigint | undefined;
  unlockedBalance: bigint | undefined;
  inputTokens: Token[];
  outputTokens: Token[];
  onSignIn: () => void;
  onApprove: () => void;
  onSwap: (options: { skipSignature?: boolean; isDepositAndSwap?: boolean }) => void;
  setSettingsVisible: (visible: boolean) => void;
  onEthereumOutputModalClose: () => void;
  onDepositModalClose: () => void;
  onValuesChange: (field: keyof TradeFormValues, value: string | number | boolean) => void;
  onChainSwitch: () => void;
  onInputChainChange: (chainId: number) => void;
  onOutputChainChange: (chainId: number) => void;
  formatBalanceDisplay: (
    unlockedBalance: bigint | undefined,
    lockedBalance: bigint | undefined,
    token: Token | undefined
  ) => React.ReactNode;
}

export function TradeFormUI({
  isConnected,
  isAuthenticated,
  isApproving,
  isDepositing,
  isWaitingForFinalization,
  isSigning,
  isExecutingSwap,
  isLoading,
  chainId,
  selectedInputChain,
  selectedOutputChain,
  selectedInputAmount,
  selectedInputToken,
  selectedOutputToken,
  formValues,
  quote,
  error,
  errorMessage,
  statusMessage,
  settingsVisible,
  ethereumOutputModalVisible,
  depositModalVisible,
  needsApproval,
  lockedBalance,
  lockedIncludingAllocated,
  unlockedBalance,
  inputTokens,
  outputTokens,
  onSignIn,
  onApprove,
  onSwap,
  setSettingsVisible,
  onEthereumOutputModalClose,
  onDepositModalClose,
  onValuesChange,
  onChainSwitch,
  onInputChainChange,
  onOutputChainChange,
  formatBalanceDisplay,
}: TradeFormUIProps) {
  const scopeOptions = [
    { label: 'Multichain', value: true },
    { label: 'Chain-specific', value: false },
  ];

  return (
    <div className="w-full max-w-2xl p-6 bg-[#0a0a0a] rounded-xl shadow-xl border border-gray-800">
      <div className="flex flex-col gap-4" data-testid="trade-form">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-semibold text-[#00ff00]">Swap</h1>
          <button
            onClick={() => setSettingsVisible(true)}
            className="p-2 text-gray-400 hover:text-gray-300 hover:bg-[#1a1a1a] rounded-lg transition-colors"
            aria-label="Settings"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="rounded-lg bg-[#0a0a0a] border border-gray-800 p-4">
          <div className="mb-2 text-sm text-white">Sell</div>
          <div className="flex items-center w-full">
            <div className="flex-1 pr-2">
              <NumberInput
                value={selectedInputAmount}
                onChange={value => onValuesChange('inputAmount', value)}
                placeholder="0.0"
                className="w-full"
                variant="borderless"
                aria-label="Input Amount"
              />
            </div>
            <div className="flex space-x-2">
              {!isConnected && (
                <Select
                  placeholder="Chain"
                  value={selectedInputChain}
                  onChange={chainId => onInputChainChange(Number(chainId))}
                  options={INPUT_CHAINS.map(chain => ({
                    label: chain.name,
                    value: chain.id,
                  }))}
                  aria-label="Input Chain"
                  className="w-32"
                />
              )}
              <Select
                value={formValues.inputToken}
                onChange={value => onValuesChange('inputToken', value.toString())}
                placeholder="Token"
                options={inputTokens
                  .filter(token =>
                    isConnected ? token.chainId === chainId : token.chainId === selectedInputChain
                  )
                  .map(token => ({
                    label: token.symbol,
                    value: token.address,
                  }))}
                aria-label="Input Token"
                data-testid="input-token-select"
                className="w-28"
              />
            </div>
          </div>
          {selectedInputToken &&
            formatBalanceDisplay(unlockedBalance, lockedBalance, selectedInputToken)}
        </div>

        <div className="flex justify-center -my-2 relative z-10">
          <button
            className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-gray-700 hover:bg-[#2a2a2a] flex items-center justify-center text-[#00ff00] transition-colors"
            onClick={onChainSwitch}
          >
            ⇵
          </button>
        </div>

        <div className="rounded-lg bg-[#0a0a0a] border border-gray-800 p-4">
          <div className="mb-2 text-sm text-white">Buy</div>
          <div className="flex items-start w-full">
            <div className="flex-1 pr-2" data-testid="quote-amount">
              <div className="text-2xl text-white">
                {quote?.context?.quoteOutputAmountNet &&
                  selectedOutputToken &&
                  formatTokenAmount(
                    BigInt(quote.context.quoteOutputAmountNet),
                    selectedOutputToken.decimals
                  )}
              </div>
              {isLoading && (
                <div className="text-sm text-gray-500 quote-loading mt-1">
                  Getting latest quote...
                </div>
              )}
            </div>
            <div className="flex space-x-2">
              <Select
                placeholder="Chain"
                value={selectedOutputChain}
                onChange={value => onOutputChainChange(Number(value))}
                options={(() => {
                  const filtered = SUPPORTED_CHAINS.filter(chain => {
                    if (isConnected) {
                      return chain.id !== chainId;
                    }
                    return chain.id !== selectedInputChain;
                  });

                  return filtered
                    .sort((a, b) => {
                      if (a.id === 130) return -1;
                      if (b.id === 130) return 1;
                      return 0;
                    })
                    .map(chain => ({
                      label: chain.name,
                      value: chain.id,
                    }));
                })()}
                aria-label="Output Chain"
                className="w-32"
              />
              <Select
                value={formValues.outputToken}
                onChange={value => onValuesChange('outputToken', value.toString())}
                placeholder="Token"
                disabled={!selectedOutputChain}
                options={outputTokens
                  .filter(token => token.chainId === selectedOutputChain)
                  .map(token => ({
                    label: token.symbol,
                    value: token.address,
                  }))}
                aria-label="Output Token"
                data-testid="output-token-select"
                className="w-28"
              />
            </div>
          </div>
          {quote?.context && (
            <div className="mt-1 text-sm text-white space-y-2">
              {!quote.context.dispensationUSD && (
                <div className="text-yellow-500">
                  Warning: Settlement cost information unavailable
                </div>
              )}
              {quote.context.dispensationUSD && (
                <div className="flex items-center gap-2">
                  <span>Settlement Cost: {quote.context.dispensationUSD}</span>
                  <TooltipIcon title="Estimated cost to a filler to dispatch a cross-chain message and claim the tokens being sold. The filler will provide this payment in addition to any gas fees required to deliver the token you are buying." />
                </div>
              )}
              {quote?.data?.mandate?.minimumAmount && selectedOutputToken && (
                <div className="flex items-center gap-2">
                  <span>
                    Minimum received:{' '}
                    {formatTokenAmount(
                      BigInt(quote.data.mandate.minimumAmount),
                      selectedOutputToken.decimals
                    )}
                  </span>
                  <TooltipIcon title="The minimum amount you will receive; the final received amount increases based on the gas priority fee the filler provides." />
                </div>
              )}
            </div>
          )}
        </div>

        {(error || errorMessage) && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-500">
            <div className="font-bold">Error</div>
            <div>{error?.message || errorMessage}</div>
          </div>
        )}

        {statusMessage && !errorMessage && (
          <div className="mt-4 text-center text-[#00ff00]">{statusMessage}</div>
        )}

        <Modal
          title="Output Chain Unavailable"
          open={ethereumOutputModalVisible}
          onClose={onEthereumOutputModalClose}
        >
          <p className="text-white mb-4">
            Ethereum is not available as the output chain for cross-chain swaps as it does not
            enforce transaction ordering by priority fee. Please select a different output chain.
          </p>
          <div className="flex justify-end">
            <button
              onClick={onEthereumOutputModalClose}
              className="px-4 py-2 bg-[#00ff00]/10 hover:bg-[#00ff00]/20 border border-gray-800 text-[#00ff00] rounded-lg"
            >
              Close
            </button>
          </div>
        </Modal>

        <Modal
          title="Deposit Required"
          open={depositModalVisible}
          onClose={onDepositModalClose}
        >
          <p className="text-white mb-4">
            {needsApproval ? (
              <>
                Token approval required. Please visit{' '}
                <a
                  href="https://smallocator.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00ff00] hover:underline"
                >
                  https://smallocator.xyz
                </a>{' '}
                to approve and deposit before making a swap.
              </>
            ) : (
              <>
                Coming soon... for now, visit{' '}
                <a
                  href="https://smallocator.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00ff00] hover:underline"
                >
                  https://smallocator.xyz
                </a>{' '}
                to perform a deposit before making a swap.
              </>
            )}
          </p>
          <div className="flex justify-end">
            <button
              onClick={onDepositModalClose}
              className="px-4 py-2 bg-[#00ff00]/10 hover:bg-[#00ff00]/20 border border-gray-800 text-[#00ff00] rounded-lg"
            >
              Close
            </button>
          </div>
        </Modal>

        {!isConnected ? (
          <div className="w-full h-12 [&>div]:h-full [&>div]:w-full [&>div>button]:h-full [&>div>button]:w-full [&>div>button]:rounded-lg [&>div>button]:flex [&>div>button]:items-center [&>div>button]:justify-center [&>div>button]:p-0 [&>div>button>div]:p-0 [&>div>button]:py-4">
            <ConnectButton />
          </div>
        ) : !isAuthenticated ? (
          <button
            onClick={onSignIn}
            className="w-full h-12 rounded-lg font-medium transition-colors bg-[#00ff00]/10 hover:bg-[#00ff00]/20 text-[#00ff00] border border-[#00ff00]/20"
          >
            Sign in to Smallocator
          </button>
        ) : (
          <button
            onClick={() => {
              if (needsApproval && selectedInputToken) {
                onApprove();
                return;
              }

              if (
                selectedInputToken &&
                selectedInputAmount &&
                lockedBalance !== undefined &&
                unlockedBalance !== undefined
              ) {
                const inputAmount = parseUnits(selectedInputAmount, selectedInputToken.decimals);
                const totalBalance = lockedBalance + unlockedBalance;

                if (totalBalance < inputAmount) {
                  return;
                } else if (lockedBalance < inputAmount) {
                  onSwap({ isDepositAndSwap: true });
                  return;
                }
              }
              onSwap({ isDepositAndSwap: false });
            }}
            disabled={(() => {
              if (isApproving) return true;
              if (needsApproval && selectedInputToken) return false;
              if (
                !quote?.data ||
                isLoading ||
                isSigning ||
                !selectedInputToken ||
                !selectedInputAmount
              ) {
                return true;
              }

              if (selectedInputToken && selectedInputAmount) {
                const inputAmount = parseUnits(selectedInputAmount, selectedInputToken.decimals);
                const totalBalance = (lockedBalance || 0n) + (unlockedBalance || 0n);
                return totalBalance < inputAmount;
              }
              return true;
            })()}
            className={`w-full h-12 rounded-lg font-medium transition-colors ${(() => {
              if (isApproving) return 'bg-gray-700 text-gray-400 cursor-not-allowed';
              if (needsApproval && selectedInputToken) {
                return 'bg-[#00ff00]/10 hover:bg-[#00ff00]/20 text-[#00ff00] border border-[#00ff00]/20';
              }
              if (
                !quote?.data ||
                isLoading ||
                isSigning ||
                !selectedInputToken ||
                !selectedInputAmount ||
                (() => {
                  if (selectedInputToken && selectedInputAmount) {
                    const inputAmount = parseUnits(
                      selectedInputAmount,
                      selectedInputToken.decimals
                    );
                    const totalBalance = (lockedBalance || 0n) + (unlockedBalance || 0n);
                    return totalBalance < inputAmount;
                  }
                  return false;
                })()
              ) {
                return 'bg-gray-700 text-gray-400 cursor-not-allowed';
              }
              return 'bg-[#00ff00]/10 hover:bg-[#00ff00]/20 text-[#00ff00] border border-[#00ff00]/20';
            })()}`}
          >
            {(() => {
              if (isApproving) return 'Waiting for approval...';
              if (needsApproval && selectedInputToken)
                return `Approve ${selectedInputToken.symbol}`;
              if (isDepositing && !isWaitingForFinalization) return 'Depositing...';
              if (isWaitingForFinalization) return 'Waiting for finalization...';
              if (isSigning) return 'Signing...';
              if (error) return 'Try Again';
              if (!selectedInputToken || !selectedInputAmount) return 'Swap';

              const inputAmount = parseUnits(selectedInputAmount, selectedInputToken.decimals);
              const totalBalance = (lockedBalance || 0n) + (unlockedBalance || 0n);

              if (totalBalance < inputAmount) {
                return 'Insufficient Balance';
              } else if (lockedBalance !== undefined && lockedBalance < inputAmount) {
                return 'Deposit & Swap';
              }
              return 'Swap';
            })()}
            {(isSigning || isApproving || isDepositing || isWaitingForFinalization) && (
              <div className="inline-block ml-2 animate-spin h-4 w-4">
                <svg className="text-current" viewBox="0 0 24 24" fill="currentColor">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            )}
          </button>
        )}

        {settingsVisible && (
          <Modal title="Settings" open={settingsVisible} onClose={() => setSettingsVisible(false)}>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-sm font-medium text-gray-400">
                    Slippage Tolerance (%)
                  </label>
                  <TooltipIcon title="Maximum allowed price movement before trade reverts. Higher values result in lowering the minimum amount received. Lower values increase the risk of the swap failing." />
                </div>
                <NumberInput
                  value={formValues.slippageTolerance}
                  onChange={value => onValuesChange('slippageTolerance', value)}
                  min={0.01}
                  max={100}
                  precision={2}
                  aria-label="Slippage tolerance percentage"
                />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-sm font-medium text-gray-400">
                    Baseline Priority Fee (GWEI)
                  </label>
                  <TooltipIcon title="Threshold transaction gas priority fee above which the filler must provide additional output tokens. Should generally only be necessary during periods of high congestion." />
                </div>
                <NumberInput
                  value={formValues.baselinePriorityFee}
                  onChange={value => onValuesChange('baselinePriorityFee', value)}
                  min={0}
                  precision={2}
                  aria-label="Baseline priority fee in GWEI"
                />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-sm font-medium text-gray-400">
                    Resource Lock Reset Period
                  </label>
                  <TooltipIcon title="Time needed to wait before you can forcibly exit a resource lock. Only relevant in cases where the allocator does not sign for an instant withdrawal. Lower values can result in higher likelihood of fillers not being able to claim the locked tokens in time. Ten minutes is the default recommended value." />
                </div>
                <SegmentedControl<number>
                  options={[
                    { label: '1s', value: ResetPeriod.OneSecond },
                    { label: '15s', value: ResetPeriod.FifteenSeconds },
                    { label: '1m', value: ResetPeriod.OneMinute },
                    { label: '10m', value: ResetPeriod.TenMinutes },
                    { label: '1h 5m', value: ResetPeriod.OneHourAndFiveMinutes },
                    { label: '1d', value: ResetPeriod.OneDay },
                    { label: '7d 1h', value: ResetPeriod.SevenDaysAndOneHour },
                    { label: '30d', value: ResetPeriod.ThirtyDays },
                  ]}
                  value={formValues.resetPeriod || ResetPeriod.TenMinutes}
                  onChange={value => onValuesChange('resetPeriod', value)}
                  aria-label="Reset Period"
                  columns={3}
                />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-sm font-medium text-gray-400">Resource Lock Scope</label>
                  <TooltipIcon title="A parameter that specifies whether or not the resource lock can be used as part of a cross-chain swap involving resource locks on other chains. Chain-specific resource locks can still be used for cross-chain swaps, but cannot be combined with other chain-specific resource locks (i.e. selling tokens across multiple chains at once)." />
                </div>
                <SegmentedControl<boolean>
                  options={scopeOptions}
                  value={formValues.isMultichain ?? true}
                  onChange={value => onValuesChange('isMultichain', value)}
                  aria-label="Resource Lock Scope"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setSettingsVisible(false)}
                className="px-4 py-2 bg-[#00ff00]/10 hover:bg-[#00ff00]/20 border border-gray-800 text-[#00ff00] rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const formatNumber = (num: number | undefined, defaultValue: string) => {
                    if (num === undefined) return defaultValue;
                    return Number(num).toString();
                  };

                  localStorage.setItem(
                    'slippageTolerance',
                    formatNumber(formValues.slippageTolerance, '0.5')
                  );
                  localStorage.setItem(
                    'baselinePriorityFee',
                    formatNumber(formValues.baselinePriorityFee, '0')
                  );

                  onValuesChange('slippageTolerance', Number(formatNumber(formValues.slippageTolerance, '0.5')));
                  onValuesChange('baselinePriorityFee', Number(formatNumber(formValues.baselinePriorityFee, '0')));
                  setSettingsVisible(false);
                }}
                className="px-4 py-2 bg-[#00ff00]/10 hover:bg-[#00ff00]/20 border border-gray-800 text-[#00ff00] rounded-lg"
              >
                Save
              </button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}
