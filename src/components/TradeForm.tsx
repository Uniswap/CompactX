import { Select } from './Select';
import { NumberInput } from './NumberInput';
import { useToast } from '../hooks/useToast';
import { Modal } from './Modal';
import { SegmentedControl } from './SegmentedControl';
import { TooltipIcon } from './TooltipIcon';
import { useAccount, useChainId } from 'wagmi';
import { useAuth } from '../hooks/useAuth';
import { ConnectButton } from '../config/wallet';
import { formatUnits, parseUnits, type Hex } from 'viem';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTokens } from '../hooks/useTokens';
import { useCalibrator } from '../hooks/useCalibrator';
import { useCompactSigner } from '../hooks/useCompactSigner';
import { useBroadcast } from '../hooks/useBroadcast';
import { useTokenBalanceCheck } from '../hooks/useTokenBalanceCheck';
import type { GetQuoteParams } from '../types/index';
import { CompactRequestPayload, Mandate } from '../types/compact';
import { BroadcastContext } from '../types/broadcast';
import { toId } from '../utils/lockId';

// Supported chains for output token
const SUPPORTED_CHAINS = [
  { id: 1, name: 'Ethereum' },
  { id: 130, name: 'Unichain' },
  { id: 8453, name: 'Base' },
  { id: 10, name: 'Optimism' },
];

// Default sponsor address when wallet is not connected
const DEFAULT_SPONSOR = '0x0000000000000000000000000000000000000000';

enum ResetPeriod {
  OneSecond = 0,
  FifteenSeconds = 1,
  OneMinute = 2,
  TenMinutes = 3,
  OneHourAndFiveMinutes = 4,
  OneDay = 5,
  SevenDaysAndOneHour = 6,
  ThirtyDays = 7
}

interface TradeFormValues {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  slippageTolerance: number;
  baselinePriorityFee: number;
  resetPeriod: ResetPeriod;
  isMultichain: boolean;
}

export function TradeForm() {
  const { isConnected, address = DEFAULT_SPONSOR } = useAccount();
  const chainId = useChainId();
  const { isAuthenticated, signIn } = useAuth();
  const { signCompact } = useCompactSigner();
  const { broadcast } = useBroadcast();
  const [quoteParams, setQuoteParams] = useState<GetQuoteParams>();
  const [selectedInputChain, setSelectedInputChain] = useState<number>(1); // Default to Ethereum
  const { inputTokens, outputTokens } = useTokens(selectedInputChain);
  const [selectedInputToken, setSelectedInputToken] = useState<
    (typeof inputTokens)[0] | undefined
  >();
  const [selectedOutputToken, setSelectedOutputToken] = useState<
    (typeof outputTokens)[0] | undefined
  >();

  const [formValues, setFormValues] = useState<Partial<TradeFormValues>>(() => ({
    inputToken: '',
    outputToken: '',
    inputAmount: '',
    slippageTolerance: localStorage.getItem('slippageTolerance')
      ? Number(localStorage.getItem('slippageTolerance'))
      : 0.5,
    baselinePriorityFee: localStorage.getItem('baselinePriorityFee')
      ? Number(localStorage.getItem('baselinePriorityFee'))
      : 0,
    resetPeriod: ResetPeriod.TenMinutes,
    isMultichain: true,
  }));

  // Calculate the lock ID whenever relevant parameters change
  const lockId = useMemo(() => {
    console.log('Calculating lock ID with:', {
      isConnected,
      tokenAddress: selectedInputToken?.address,
      resetPeriod: formValues.resetPeriod,
      isMultichain: formValues.isMultichain
    });

    if (!isConnected || !selectedInputToken?.address || !formValues.resetPeriod) {
      console.log('Missing required params for lock ID');
      return undefined;
    }
    
    try {
      // Use enum value directly (0-7) for reset period
      const resetPeriodIndex = formValues.resetPeriod;
      
      console.log('Reset period calculation:', {
        resetPeriodEnum: formValues.resetPeriod,
        resetPeriodIndex,
      });

      const id = toId(
        formValues.isMultichain ?? true,
        resetPeriodIndex,
        '1223867955028248789127899354', // allocatorId
        selectedInputToken.address
      );
      console.log('Calculated lock ID:', {
        decimal: id.toString(),
        hex: '0x' + id.toString(16)
      });
      return id;
    } catch (error) {
      console.error('Error calculating lock ID:', error);
      return undefined;
    }
  }, [isConnected, selectedInputToken?.address, formValues.resetPeriod, formValues.isMultichain]);

  const { data: quote, isLoading, error } = useCalibrator().useQuote(quoteParams);
  const { lockedBalance, unlockedBalance } = useTokenBalanceCheck(
    selectedInputToken?.address as `0x${string}` | undefined,
    lockId
  );

  // Format balance with proper decimals
  const formatTokenAmount = (balance: bigint | undefined, decimals: number) => {
    if (!balance) return '0';
    return (Number(balance) / 10 ** decimals).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4
    });
  };

  // Format balance display as "unlocked / total symbol"
  const formatBalanceDisplay = (unlockedBalance: bigint | undefined, lockedBalance: bigint | undefined, token: (typeof inputTokens)[0] | undefined) => {
    if (!token) return '';
    
    const unlocked = unlockedBalance || 0n;
    const locked = lockedBalance || 0n;
    const total = unlocked + locked;
    
    const unlockedFormatted = formatTokenAmount(unlocked, token.decimals);
    const totalFormatted = formatTokenAmount(total, token.decimals);
    
    return (
      <div className="mt-2 text-sm">
        <span className="text-gray-400">{unlockedFormatted}</span>
        <span className="text-gray-400"> / </span>
        <span className="text-green-400">{totalFormatted} {token.symbol}</span>
      </div>
    );
  };

  // Log balances whenever they change
  useEffect(() => {
    console.log('Balance check effect triggered:', {
      isConnected,
      hasInputToken: !!selectedInputToken,
      hasLockId: !!lockId,
      hasLockedBalance: lockedBalance !== undefined,
      hasUnlockedBalance: unlockedBalance !== undefined
    });

    if (isConnected && selectedInputToken && lockId !== undefined && lockedBalance !== undefined && unlockedBalance !== undefined) {
      console.log('Lock ID:', lockId.toString());
      console.log('Locked balance in The Compact:', lockedBalance.toString());
      console.log('Unlocked balance in input token:', unlockedBalance.toString());
      
      const formattedLocked = formatTokenAmount(lockedBalance, selectedInputToken.decimals);
      const formattedUnlocked = formatTokenAmount(unlockedBalance, selectedInputToken.decimals);
      console.log('Formatted balances:', { formattedLocked, formattedUnlocked });
    }
  }, [isConnected, selectedInputToken, lockId, lockedBalance, unlockedBalance]);

  const { showToast } = useToast();
  const [settingsVisible, setSettingsVisible] = useState(false);
  // Initialize with Unichain as default output chain
  const [selectedOutputChain, setSelectedOutputChain] = useState<number>(130);
  const [isSigning, setIsSigning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Map reset period enum to seconds for calibrator
  const resetPeriodToSeconds = (resetPeriod: ResetPeriod): number => {
    const mapping = {
      [ResetPeriod.FifteenSeconds]: 15,
      [ResetPeriod.OneMinute]: 60,
      [ResetPeriod.TenMinutes]: 600,
      [ResetPeriod.OneHourAndFiveMinutes]: 3900,
      [ResetPeriod.OneDay]: 86400,
      [ResetPeriod.SevenDaysAndOneHour]: 604800,
      [ResetPeriod.ThirtyDays]: 2592000
    };
    return mapping[resetPeriod];
  };

  // Update quote parameters when inputs change
  useEffect(() => {
    if (
      !isConnected ||
      !selectedInputToken?.address ||
      !selectedOutputToken?.address ||
      !formValues.inputAmount ||
      !formValues.resetPeriod
    ) {
      setQuoteParams(undefined);
      return;
    }

    const newParams: GetQuoteParams = {
      inputTokenChainId: selectedInputToken.chainId,
      inputTokenAddress: selectedInputToken.address,
      inputTokenAmount: formValues.inputAmount,
      outputTokenChainId: selectedOutputToken.chainId,
      outputTokenAddress: selectedOutputToken.address,
      slippageBips: Math.round(formValues.slippageTolerance * 100),
      allocatorId: '1223867955028248789127899354',
      resetPeriod: resetPeriodToSeconds(formValues.resetPeriod),
      isMultichain: formValues.isMultichain,
      sponsor: address,
      baselinePriorityFee: formValues.baselinePriorityFee?.toString(),
    };

    setQuoteParams(newParams);
  }, [
    isConnected,
    selectedInputToken,
    selectedOutputToken,
    formValues.inputAmount,
    formValues.slippageTolerance,
    formValues.resetPeriod,
    formValues.isMultichain,
    formValues.baselinePriorityFee,
    address,
  ]);

  // Handle form value changes
  const handleValuesChange = useCallback(
    (field: keyof TradeFormValues, value: string | number | boolean) => {
      const newValues = { ...formValues, [field]: value };
      setFormValues(newValues);

      // Update selected tokens
      const newInputToken = inputTokens.find(token => token.address === newValues.inputToken);
      const newOutputToken = outputTokens.find(token => token.address === newValues.outputToken);

      if (newInputToken !== selectedInputToken) {
        setSelectedInputToken(newInputToken);
      }

      if (newOutputToken !== selectedOutputToken) {
        setSelectedOutputToken(newOutputToken);
      }

      // Update quote params if we have all required values
      if (
        newValues.inputToken &&
        newValues.inputAmount &&
        newValues.outputToken &&
        selectedOutputChain &&
        newInputToken
      ) {
        // Convert decimal input to token units
        const tokenUnits = parseUnits(newValues.inputAmount, newInputToken.decimals).toString();

        const params: GetQuoteParams = {
          inputTokenChainId: isConnected ? chainId : selectedInputChain,
          inputTokenAddress: newValues.inputToken,
          inputTokenAmount: tokenUnits,
          outputTokenChainId: selectedOutputChain,
          outputTokenAddress: newValues.outputToken,
          slippageBips: Math.floor(Number(newValues.slippageTolerance) * 100),
          baselinePriorityFee: newValues.baselinePriorityFee
            ? BigInt(Math.floor(newValues.baselinePriorityFee * 1e9)).toString()
            : undefined,
          resetPeriod: resetPeriodToSeconds(newValues.resetPeriod),
          isMultichain: newValues.isMultichain,
          sponsor: isConnected ? address : DEFAULT_SPONSOR,
          allocatorId: '1223867955028248789127899354',
        };
        setQuoteParams(params);
      }
    },
    [
      formValues,
      inputTokens,
      outputTokens,
      selectedOutputChain,
      isConnected,
      chainId,
      selectedInputToken,
      selectedOutputToken,
      address,
      selectedInputChain,
    ]
  );

  // Handle chain changes and conflicts
  useEffect(() => {
    if (isConnected && chainId === selectedOutputChain) {
      // When connected and chainId matches output chain, select first available chain (preferring Unichain)
      const availableChains = SUPPORTED_CHAINS.filter(
        chain => chain.id !== chainId && chain.id !== 1
      );
      const unichain = availableChains.find(chain => chain.id === 130);
      setSelectedOutputChain(unichain ? unichain.id : availableChains[0].id);
      setSelectedOutputToken(undefined);
      setFormValues(prev => ({ ...prev, outputToken: '' }));
    }
  }, [chainId, isConnected, selectedOutputChain]);

  // Refresh quote when wallet connects if form is filled out
  useEffect(() => {
    if (isConnected && quoteParams && formValues.inputAmount) {
      // Re-trigger quote fetch with current form values
      handleValuesChange('inputAmount', formValues.inputAmount);
    }
  }, [isConnected, quoteParams, formValues.inputAmount, handleValuesChange]);

  // Handle the actual swap after quote is received
  const handleSwap = async () => {
    try {
      setIsSigning(true);
      setStatusMessage('Requesting allocation...');

      // Ensure we have a quote
      if (!quote?.data || !quote.context) {
        throw new Error('No quote available');
      }

      // Ensure we have a valid salt
      if (!quote.data.mandate.salt) {
        throw new Error('Invalid salt value');
      }

      // Create mandate with required properties
      const mandate: Mandate = {
        chainId: quote.data.mandate.chainId,
        tribunal: quote.data.mandate.tribunal,
        recipient: quote.data.mandate.recipient,
        expires: quote.data.mandate.expires,
        token: quote.data.mandate.token,
        minimumAmount: quote.data.mandate.minimumAmount,
        baselinePriorityFee: quote.data.mandate.baselinePriorityFee,
        scalingFactor: quote.data.mandate.scalingFactor,
        salt: quote.data.mandate.salt.startsWith('0x')
          ? (quote.data.mandate.salt as Hex)
          : (`0x${quote.data.mandate.salt}` as Hex),
      } satisfies Mandate;

      const compactMessage = {
        arbiter: quote.data.arbiter,
        sponsor: quote.data.sponsor,
        nonce: null,
        expires: quote.data.expires,
        id: quote.data.id,
        amount: quote.data.amount,
        mandate,
      };

      setStatusMessage('Allocation received — sign to confirm...');

      const { userSignature, smallocatorSignature, nonce } = await signCompact({
        chainId: quote.data.mandate.chainId.toString(),
        currentChainId: chainId.toString(),
        tribunal: quote.data.mandate.tribunal,
        compact: compactMessage,
      });

      setStatusMessage('Broadcasting intent...');

      const broadcastPayload: CompactRequestPayload = {
        chainId: chainId.toString(),
        compact: {
          ...compactMessage,
          nonce,
          mandate: {
            ...mandate,
            chainId: quote.data.mandate.chainId,
            tribunal: quote.data.mandate.tribunal,
          },
        },
      };

      const broadcastContext: BroadcastContext = {
        ...quote.context,
        witnessHash: quote.context.witnessHash,
        witnessTypeString:
          'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
      };

      const broadcastResponse = await broadcast(
        broadcastPayload,
        userSignature,
        smallocatorSignature,
        broadcastContext
      );

      if (!broadcastResponse.success) {
        throw new Error('Failed to broadcast trade');
      }

      setFormValues({
        inputToken: '',
        outputToken: '',
        inputAmount: '',
        slippageTolerance: 0.5,
        baselinePriorityFee: 0,
        resetPeriod: ResetPeriod.TenMinutes,
        isMultichain: true,
      });
      setStatusMessage('');
      showToast('Trade broadcast successfully', 'success');
    } catch (error) {
      console.error('Error executing swap:', error);
      setStatusMessage('');
      showToast('Failed to execute trade', 'error');
    } finally {
      setIsSigning(false);
    }
  };

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
                value={formValues.inputAmount}
                onChange={value => handleValuesChange('inputAmount', value)}
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
                  onChange={value => {
                    const newChainId = Number(value);
                    if (newChainId !== selectedInputChain) {
                      setSelectedInputChain(newChainId);
                      setSelectedInputToken(undefined);
                      // Clear quote parameters when input chain changes
                      setQuoteParams(undefined);
                      setFormValues(prev => ({ ...prev, inputToken: '', inputAmount: '' }));

                      // Only reset output chain if it conflicts with new input chain
                      if (selectedOutputChain === newChainId) {
                        // Try to set to Unichain first, fallback to first available non-conflicting chain
                        const availableChains = SUPPORTED_CHAINS.filter(chain => {
                          if (isConnected) {
                            return chain.id !== chainId && chain.id !== 1;
                          }
                          return chain.id !== selectedInputChain && chain.id !== 1;
                        });

                        // Sort to ensure Unichain appears first if available
                        const unichain = availableChains.find(chain => chain.id === 130);
                        setSelectedOutputChain(unichain ? unichain.id : availableChains[0].id);
                        setSelectedOutputToken(undefined);
                        setFormValues(prev => ({ ...prev, outputToken: '' }));
                      }
                    }
                  }}
                  options={SUPPORTED_CHAINS.map(chain => ({
                    label: chain.name,
                    value: chain.id,
                  }))}
                  aria-label="Input Chain"
                  className="w-32"
                />
              )}
              <Select
                value={formValues.inputToken}
                onChange={value => handleValuesChange('inputToken', value.toString())}
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
          {selectedInputToken && formatBalanceDisplay(unlockedBalance, lockedBalance, selectedInputToken)}
        </div>

        <div className="flex justify-center -my-2 relative z-10">
          <button
            className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-gray-700 hover:bg-[#2a2a2a] flex items-center justify-center text-[#00ff00] transition-colors"
            onClick={() => {
              // Swap token selections
              const newValues = {
                ...formValues,
                inputToken: formValues.outputToken,
                outputToken: formValues.inputToken,
                inputAmount: '', // Clear amount since token decimals might be different
              };
              setFormValues(newValues);
              setSelectedInputToken(selectedOutputToken);
              setSelectedOutputToken(selectedInputToken);
              setQuoteParams(undefined); // Clear quote when swapping tokens
            }}
          >
            ↓
          </button>
        </div>

        <div className="rounded-lg bg-[#0a0a0a] border border-gray-800 p-4">
          <div className="mb-2 text-sm text-white">Buy</div>
          <div className="flex items-center w-full">
            <div className="flex-1 pr-2 text-2xl text-white" data-testid="quote-amount">
              {quote?.context?.quoteOutputAmountNet && selectedOutputToken
                ? formatUnits(
                    BigInt(quote.context.quoteOutputAmountNet),
                    selectedOutputToken.decimals
                  )
                : '0.00'}
            </div>
            <div className="flex space-x-2">
              <Select
                placeholder="Chain"
                value={selectedOutputChain}
                onChange={value => {
                  const newChainId = Number(value);
                  if (newChainId !== selectedOutputChain) {
                    setSelectedOutputChain(newChainId);
                    setSelectedOutputToken(undefined);
                    // Clear quote parameters when output chain changes
                    setQuoteParams(undefined);
                    setFormValues(prev => ({ ...prev, outputToken: '' }));
                  }
                }}
                options={(() => {
                  // Filter available chains
                  const filtered = SUPPORTED_CHAINS.filter(chain => {
                    if (isConnected) {
                      return chain.id !== chainId && chain.id !== 1;
                    }
                    return chain.id !== selectedInputChain && chain.id !== 1;
                  });

                  // Sort to ensure Unichain appears first if available
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
                onChange={value => {
                  handleValuesChange('outputToken', value.toString());
                  const token = outputTokens.find(t => t.address === value.toString());
                  setSelectedOutputToken(token);
                }}
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
                  <TooltipIcon title="Estimated cost to a filler to dispatch a cross-chain message and claim the tokens being sold" />
                </div>
              )}
              {quote?.data?.mandate?.minimumAmount && selectedOutputToken && (
                <div className="flex items-center gap-2">
                  <span>
                    Minimum received:{' '}
                    {Number(
                      formatUnits(
                        BigInt(quote.data.mandate.minimumAmount),
                        selectedOutputToken.decimals
                      )
                    ).toString()}
                  </span>
                  <TooltipIcon title="The minimum amount you will receive; the final received amount increases based on the gas priority fee the filler provides" />
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-500">
            <div className="font-bold">Error</div>
            <div>{error.message}</div>
          </div>
        )}

        {statusMessage && <div className="mt-4 text-center text-[#00ff00]">{statusMessage}</div>}

        {!isConnected ? (
          <div className="w-full h-12 [&>div]:h-full [&>div]:w-full [&>div>button]:h-full [&>div>button]:w-full [&>div>button]:rounded-lg [&>div>button]:flex [&>div>button]:items-center [&>div>button]:justify-center [&>div>button]:p-0 [&>div>button>div]:p-0 [&>div>button]:py-4">
            <ConnectButton />
          </div>
        ) : !isAuthenticated ? (
          <button
            onClick={signIn}
            className="w-full h-12 rounded-lg font-medium transition-colors bg-[#00ff00]/10 hover:bg-[#00ff00]/20 text-[#00ff00] border border-[#00ff00]/20"
          >
            Sign in to Smallocator
          </button>
        ) : (
          <button
            onClick={handleSwap}
            disabled={!quote?.data || isLoading || isSigning}
            className={`w-full h-12 rounded-lg font-medium transition-colors ${
              !quote?.data || isLoading || isSigning
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-[#00ff00]/10 hover:bg-[#00ff00]/20 text-[#00ff00] border border-[#00ff00]/20'
            }`}
          >
            {isSigning ? 'Signing...' : error ? 'Try Again' : 'Swap'}
            {isSigning && (
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
      </div>

      {settingsVisible && (
        <Modal title="Settings" open={settingsVisible} onClose={() => setSettingsVisible(false)}>
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="text-sm font-medium text-gray-400">Slippage Tolerance (%)</label>
                <TooltipIcon title="Maximum allowed price movement before trade reverts" />
              </div>
              <NumberInput
                value={formValues.slippageTolerance}
                onChange={value => handleValuesChange('slippageTolerance', value)}
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
                <TooltipIcon title="Minimum gas priority fee for transaction" />
              </div>
              <NumberInput
                value={formValues.baselinePriorityFee}
                onChange={value => handleValuesChange('baselinePriorityFee', value)}
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
                <TooltipIcon title="The reset period on the resource lock" />
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
                onChange={value => handleValuesChange('resetPeriod', value)}
                aria-label="Reset Period"
                columns={3}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="text-sm font-medium text-gray-400">Resource Lock Scope</label>
                <TooltipIcon title="The scope of the resource lock" />
              </div>
              <SegmentedControl<boolean>
                options={scopeOptions}
                value={formValues.isMultichain ?? true}
                onChange={value => handleValuesChange('isMultichain', value)}
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
                // Format numbers before saving
                const formatNumber = (num: number | undefined, defaultValue: string) => {
                  if (num === undefined) return defaultValue;
                  // Convert to number to remove unnecessary zeros, then back to string
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

                // Update form values with formatted numbers
                setFormValues(prev => ({
                  ...prev,
                  slippageTolerance: Number(formatNumber(formValues.slippageTolerance, '0.5')),
                  baselinePriorityFee: Number(formatNumber(formValues.baselinePriorityFee, '0')),
                }));

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
  );
}
