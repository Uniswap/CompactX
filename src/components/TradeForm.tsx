import { Select } from './Select';
import { NumberInput } from './NumberInput';
import { useToast } from './Toast';
import { Modal } from './Modal';
import { Tooltip } from './Tooltip';
import { useAccount, useChainId } from 'wagmi';
import { ConnectButton } from '../config/wallet';
import { formatUnits, parseUnits, type Hex } from 'viem';
import { useState, useEffect } from 'react';
import { useTokens } from '../hooks/useTokens';
import { useCalibrator } from '../hooks/useCalibrator';
import { useCompactSigner } from '../hooks/useCompactSigner';
import { useBroadcast } from '../hooks/useBroadcast';
import type { GetQuoteParams } from '../types/index';
import { CompactRequestPayload, Mandate } from '../types/compact';
import { BroadcastContext } from '../types/broadcast';

// Supported chains for output token
const SUPPORTED_CHAINS = [
  { id: 1, name: 'Ethereum' },
  { id: 10, name: 'Optimism' },
  { id: 8453, name: 'Base' },
  { id: 130, name: 'Unichain' },
];

// Default sponsor address when wallet is not connected
const DEFAULT_SPONSOR = '0x0000000000000000000000000000000000000000';

interface TradeFormValues {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  slippageTolerance: number;
}

export function TradeForm() {
  const { isConnected, address = DEFAULT_SPONSOR } = useAccount();
  const chainId = useChainId();
  const { inputTokens, outputTokens } = useTokens();
  const { signCompact } = useCompactSigner();
  const { broadcast } = useBroadcast();
  const [quoteParams, setQuoteParams] = useState<GetQuoteParams>();
  const { data: quote, isLoading, error } = useCalibrator().useQuote(quoteParams);
  const [formValues, setFormValues] = useState<Partial<TradeFormValues>>({
    inputToken: '',
    outputToken: '',
    inputAmount: '',
    slippageTolerance: 0.5,
  });
  const { showToast } = useToast();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [selectedInputChain, setSelectedInputChain] = useState<number>(1); // Default to Ethereum
  const [selectedOutputChain, setSelectedOutputChain] = useState<number | undefined>(undefined);
  const [isSigning, setIsSigning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [selectedInputToken, setSelectedInputToken] = useState<
    (typeof inputTokens)[0] | undefined
  >();
  const [selectedOutputToken, setSelectedOutputToken] = useState<
    (typeof outputTokens)[0] | undefined
  >();

  // Initialize and manage output chain selection
  useEffect(() => {
    const availableChains = SUPPORTED_CHAINS.filter(
      chain => chain.id !== chainId && chain.id !== 1
    );

    // If no chains available, reset everything
    if (availableChains.length === 0) {
      setSelectedOutputChain(undefined);
      setSelectedOutputToken(undefined);
      setFormValues(prev => ({ ...prev, outputToken: '' }));
      return;
    }

    // If current selection is invalid (matches current chain or not in available chains)
    const isCurrentSelectionInvalid =
      selectedOutputChain === undefined ||
      selectedOutputChain === chainId ||
      !availableChains.some(chain => chain.id === selectedOutputChain);

    if (isCurrentSelectionInvalid) {
      setSelectedOutputChain(availableChains[0].id);
    }
  }, [chainId]); // Only run when chainId changes

  // Refresh quote when wallet connects if form is filled out
  useEffect(() => {
    if (isConnected && quoteParams) {
      // Re-trigger quote fetch with current form values
      handleValuesChange('inputAmount', formValues.inputAmount || '');
    }
  }, [isConnected]); // Re-run when wallet connection status changes

  // Handle form value changes
  const handleValuesChange = (field: keyof TradeFormValues, value: string | number) => {
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
      const slippageTolerance = localStorage.getItem('slippageTolerance')
        ? Number(localStorage.getItem('slippageTolerance'))
        : 0.5;

      // Convert decimal input to token units
      const tokenUnits = parseUnits(newValues.inputAmount, newInputToken.decimals).toString();

      const params = {
        inputTokenChainId: isConnected ? chainId : selectedInputChain,
        inputTokenAddress: newValues.inputToken,
        inputTokenAmount: tokenUnits,
        outputTokenChainId: selectedOutputChain,
        outputTokenAddress: newValues.outputToken,
        slippageBips: Math.round(slippageTolerance * 100),
        allocatorId: '1223867955028248789127899354',
        resetPeriod: 600,
        isMultichain: true,
      } as const;
      setQuoteParams({
        ...params,
        sponsor: isConnected ? address : DEFAULT_SPONSOR,
      });
    }
  };

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
                min={0}
                precision={selectedInputToken?.decimals ?? 18}
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
                      setFormValues(prev => ({ ...prev, inputToken: '' }));

                      // If output chain conflicts with new input chain, change it to first available chain
                      if (selectedOutputChain === newChainId) {
                        const availableChains = SUPPORTED_CHAINS.filter(
                          chain => chain.id !== newChainId && chain.id !== 1
                        );
                        if (availableChains.length > 0) {
                          setSelectedOutputChain(availableChains[0].id);
                          setSelectedOutputToken(undefined);
                          setFormValues(prev => ({ ...prev, outputToken: '' }));
                        }
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
              };
              setFormValues(newValues);
              setSelectedInputToken(selectedOutputToken);
              setSelectedOutputToken(selectedInputToken);
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
                    setFormValues(prev => ({ ...prev, outputToken: '' }));
                  }
                }}
                options={SUPPORTED_CHAINS.filter(chain => {
                  // When connected, filter out current chain and Ethereum
                  if (isConnected) {
                    return chain.id !== chainId && chain.id !== 1;
                  }
                  // When not connected, filter out manually selected input chain
                  return chain.id !== selectedInputChain && chain.id !== 1;
                }).map(chain => ({
                  label: chain.name,
                  value: chain.id,
                }))}
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
          {quote?.context?.dispensationUSD && (
            <div className="mt-1 text-sm text-white space-y-2">
              <div className="flex items-center gap-2">
                <span>Settlement Cost: {quote.context.dispensationUSD}</span>
                <Tooltip title="Estimated cost to a filler to dispatch a cross-chain message and claim the tokens being sold">
                  <svg className="w-4 h-4 text-gray-200" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Tooltip>
              </div>
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
                  <Tooltip title="The minimum amount you will receive; the final received amount increases based on the gas priority fee the filler provides">
                    <svg className="w-4 h-4 text-gray-200" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </Tooltip>
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
                <svg className="text-current" viewBox="0 0 24 24">
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
          <div className="py-4 text-gray-200">
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Slippage Tolerance (%)
              </label>
              <NumberInput
                value={formValues.slippageTolerance?.toString()}
                onChange={value => handleValuesChange('slippageTolerance', Number(value))}
                min={0}
                max={100}
                precision={1}
                placeholder="0.5"
                aria-label="Slippage Tolerance"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSettingsVisible(false)}
                className="px-4 py-2 bg-[#00ff00]/10 hover:bg-[#00ff00]/20 border border-gray-800 text-[#00ff00] rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  localStorage.setItem(
                    'slippageTolerance',
                    formValues.slippageTolerance?.toString() || '0.5'
                  );
                  setSettingsVisible(false);
                }}
                className="px-4 py-2 bg-[#00ff00]/10 hover:bg-[#00ff00]/20 border border-gray-800 text-[#00ff00] rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
