import { useToast } from '../hooks/useToast';
import { TradeFormUI } from './TradeFormUI';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { useAuth } from '../hooks/useAuth';
import { parseUnits, type Hex } from 'viem';
import {
  formatTokenAmount,
  MAX_UINT256,
  SUPPORTED_CHAINS,
  DEFAULT_SPONSOR,
  ResetPeriod,
  deriveClaimHash,
  resetPeriodToSeconds,
  type TradeFormValues
} from '../utils/tradeUtils';
import type { Token } from '../types/index';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTokens } from '../hooks/useTokens';
import { useCalibrator } from '../hooks/useCalibrator';
import { useCompactSigner } from '../hooks/useCompactSigner';
import { useBroadcast } from '../hooks/useBroadcast';
import { useTokenBalanceCheck } from '../hooks/useTokenBalanceCheck';
import type { GetQuoteParams } from '../types/index';
import { CompactRequestPayload, Mandate } from '../types/compact';
import { BroadcastContext } from '../types/broadcast';
import { toId } from '../utils/lockId';
import { erc20Abi } from 'viem';
import { usePublicClient, useReadContract, useWriteContract } from 'wagmi';
import { useHealthCheck } from '../hooks/useHealthCheck';
import { smallocator } from '../api/smallocator';

export function TradeForm() {
  const { isConnected, address = DEFAULT_SPONSOR } = useAccount();
  const chainId = useChainId();
  const { isAuthenticated, signIn } = useAuth();
  const { signCompact } = useCompactSigner();
  const { broadcast } = useBroadcast();
  const { switchChain } = useSwitchChain();
  const { showToast } = useToast();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [quoteParams, setQuoteParams] = useState<GetQuoteParams>();
  const [quoteVersion] = useState(0);
  const [selectedInputChain, setSelectedInputChain] = useState<number>(chainId || 1);
  const [selectedInputAmount, setSelectedInputAmount] = useState<string>('');

  // Track connection state to handle initial connection
  const wasConnectedRef = useRef(false);
  useEffect(() => {
    if (isConnected && !wasConnectedRef.current) {
      // Only switch chains on initial connection if needed
      if (chainId !== selectedInputChain) {
        switchChain?.({ chainId: selectedInputChain });
      }
      wasConnectedRef.current = true;
    } else if (!isConnected) {
      wasConnectedRef.current = false;
    }
  }, [isConnected, chainId, selectedInputChain, switchChain]);

  // Keep track of last connected chain to restore it when disconnecting
  const lastConnectedChainRef = useRef(chainId);
  useEffect(() => {
    if (isConnected && chainId) {
      lastConnectedChainRef.current = chainId;
      setSelectedInputChain(chainId);
    } else if (!isConnected && lastConnectedChainRef.current) {
      // When disconnecting, set the input chain to the last connected chain
      setSelectedInputChain(lastConnectedChainRef.current);
    }
  }, [isConnected, chainId]);

  const { inputTokens, outputTokens } = useTokens(selectedInputChain);
  const [selectedInputToken, setSelectedInputToken] = useState<Token | undefined>();
  const [selectedOutputToken, setSelectedOutputToken] = useState<Token | undefined>();

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
    if (!isConnected || !selectedInputToken?.address || !formValues.resetPeriod) {
      return undefined;
    }

    try {
      return toId(
        formValues.isMultichain ?? true,
        formValues.resetPeriod,
        '1223867955028248789127899354', // allocatorId
        selectedInputToken.address
      );
    } catch (error) {
      console.error('Error calculating lock ID:', error);
      return undefined;
    }
  }, [isConnected, selectedInputToken?.address, formValues.resetPeriod, formValues.isMultichain]);

  const [isExecutingSwap, setIsExecutingSwap] = useState(false);
  const { data: quote, isLoading, error } = useCalibrator().useQuote(quoteParams, quoteVersion, isExecutingSwap);
  const { lockedBalance, lockedIncludingAllocated, unlockedBalance } = useTokenBalanceCheck(
    selectedInputToken?.address as `0x${string}` | undefined,
    lockId
  );

  // Format balance display as "unlocked / total symbol"
  const formatBalanceDisplay = (
    unlockedBalance: bigint | undefined,
    lockedBalance: bigint | undefined,
    token: Token | undefined
  ) => {
    if (!token || !isConnected) return '';

    const unlocked = unlockedBalance || 0n;
    const locked = lockedBalance || 0n;
    const total = unlocked + locked;

    const lockedFormatted = formatTokenAmount(lockedBalance || 0n, token.decimals);
    const totalFormatted = formatTokenAmount(total, token.decimals);
    const lockedIncludingAllocatedFormatted = formatTokenAmount(lockedIncludingAllocated || 0n, token.decimals);

    return (
      <div className="mt-2 text-sm">
        <span className="text-gray-400">{lockedFormatted}</span>
        {lockedBalance !== lockedIncludingAllocated && (
          <>
            <span className="text-gray-400">/</span>
            <span className="text-yellow-500">{lockedIncludingAllocatedFormatted}</span>
          </>
        )}
        <span className="text-gray-400"> / </span>
        <span className="text-green-400">
          {totalFormatted} {token.symbol}
        </span>
      </div>
    );
  };

  const [settingsVisible, setSettingsVisible] = useState(false);
  // Initialize with Unichain as default output chain
  const [selectedOutputChain, setSelectedOutputChain] = useState<number>(130);
  const [isSigning, setIsSigning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [ethereumOutputModalVisible, setEthereumOutputModalVisible] = useState(false);

  // Update timestamp in quote params every 5 seconds unless executing swap
  useEffect(() => {
    if (isExecutingSwap || !quoteParams) return;
    
    const interval = setInterval(() => {
      setQuoteParams(prev => ({
        ...prev!,
        timestamp: Math.floor(Date.now() / 15000) * 15000,
      }));
    }, 15000);

    return () => clearInterval(interval);
  }, [isExecutingSwap, quoteParams]);

  // Update quote parameters when inputs change, but not during swap execution
  useEffect(() => {
    if (isExecutingSwap) {
      return;
    }

    // Only proceed with input amount and input token
    if (!selectedInputToken?.address || !selectedInputAmount) {
      return;
    }

    // Only proceed with setting new quote params if we have output token
    if (!selectedOutputToken?.address) {
      return;
    }

    // Ensure we have valid chain IDs
    if (typeof selectedInputChain !== 'number' || typeof selectedOutputChain !== 'number') {
      setQuoteParams(undefined);
      return;
    }

    const newParams: GetQuoteParams = {
      inputTokenChainId: selectedInputChain,
      inputTokenAddress: selectedInputToken.address,
      inputTokenAmount: parseUnits(selectedInputAmount, selectedInputToken.decimals).toString(),
      outputTokenChainId: selectedOutputChain,
      outputTokenAddress: selectedOutputToken.address,
      slippageBips: Math.round(Number(formValues.slippageTolerance || 0.5) * 100),
      allocatorId: '1223867955028248789127899354',
      resetPeriod: resetPeriodToSeconds(formValues.resetPeriod || ResetPeriod.TenMinutes),
      isMultichain: formValues.isMultichain ?? true,
      sponsor: isConnected ? address : DEFAULT_SPONSOR,
      baselinePriorityFee: formValues.baselinePriorityFee
        ? parseUnits(formValues.baselinePriorityFee.toString(), 9).toString()
        : '0',
      timestamp: Math.floor(Date.now() / 5000) * 5000,
    };
    setQuoteParams(newParams);
  }, [
    isExecutingSwap,
    isConnected,
    selectedInputToken?.address,
    selectedInputAmount,
    selectedOutputToken?.address,
    selectedOutputChain,
    formValues.slippageTolerance,
    formValues.resetPeriod,
    formValues.isMultichain,
    formValues.baselinePriorityFee,
    address,
  ]);

  // Handle form value changes
  const handleValuesChange = useCallback(
    (field: keyof TradeFormValues, value: string | number | boolean) => { 
      // Update selected tokens if token fields change
      if (field === 'inputToken') {
        const newInputToken = inputTokens.find(token => token.address === value);
        if (newInputToken && newInputToken !== selectedInputToken) {
          setSelectedInputToken(newInputToken);
        }
      } else if (field === 'outputToken') {
        const newOutputToken = outputTokens.find(token => 
          token.address === value && token.chainId === selectedOutputChain
        );
        if (newOutputToken && newOutputToken !== selectedOutputToken) {
          setSelectedOutputToken(newOutputToken);
        }
      } else if (field === 'inputAmount') {
        setSelectedInputAmount(value as string);
      }

      setFormValues(prev => {
        const newValues = { ...prev, [field]: value };
        return newValues;
      });
    },
    [inputTokens, outputTokens, selectedInputToken, selectedOutputToken, selectedOutputChain]
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

  // Handle the actual swap after quote is received
  const handleSwap = async (options: { skipSignature?: boolean; isDepositAndSwap?: boolean } = {}) => {
    const { skipSignature = false, isDepositAndSwap = false } = options;
    try {
      setIsSigning(true);
      setIsExecutingSwap(true);
      console.log(isDepositAndSwap ? 'Executing Deposit & Swap...' : 'Executing standard swap...');
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
          ? (quote.data.mandate.salt as `0x${string}`)
          : (`0x${quote.data.mandate.salt}` as `0x${string}`),
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

      setStatusMessage(
        skipSignature ? 'Preparing broadcast...' : 'Allocation received — sign to confirm...'
      );

      let userSignature = '0x';
      let smallocatorSignature = '0x';
      let nonce = '0';

      if (!skipSignature) {
        // Get signatures only if not skipping
        const signatures = await signCompact({
          chainId: quote.data.mandate.chainId.toString(),
          currentChainId: chainId.toString(),
          tribunal: quote.data.mandate.tribunal,
          compact: compactMessage,
        });
        userSignature = signatures.userSignature;
        smallocatorSignature = signatures.smallocatorSignature;
        nonce = signatures.nonce;
      } else {
        // When skipping signature (after deposit), only get smallocator signature
        const witnessHash = quote.context.witnessHash;
        const smallocatorRequest = {
          chainId: chainId.toString(),
          compact: {
            arbiter: quote.data.arbiter,
            sponsor: quote.data.sponsor,
            nonce: null,
            expires: quote.data.expires,
            id: quote.data.id,
            amount: quote.data.amount,
            witnessHash,
            witnessTypeString:
              'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
          },
        };

        console.log('Making request to smallocator...');
        const { signature, nonce: newNonce } = await smallocator.submitCompact(smallocatorRequest, { isDepositAndSwap: false });
        smallocatorSignature = signature;
        nonce = newNonce;
      }

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
      // For standard swaps, show error immediately
      // For deposit & swap, error handling is managed by the retry logic in handleDepositAndSwap
      if (!isDepositAndSwap) {
        setStatusMessage('');
        if (error instanceof Error && error.message.toLowerCase().includes('user rejected')) {
          setErrorMessage('Swap confirmation rejected.');
          showToast('Swap confirmation rejected.', 'error');
        } else {
          setErrorMessage(error instanceof Error ? error.message : 'Failed to execute trade');
          showToast(error instanceof Error ? error.message : 'Failed to execute trade', 'error');
        }
      }
      // Re-throw error for deposit & swap so it can be handled by the retry logic
      if (isDepositAndSwap) {
        throw error;
      }
    } finally {
      setIsSigning(false);
      if (!isDepositAndSwap) {
        setIsExecutingSwap(false);
      }
    }
  };

  const scopeOptions = [
    { label: 'Multichain', value: true },
    { label: 'Chain-specific', value: false },
  ];

  const [needsApproval, setNeedsApproval] = useState(false);

  // Calculate shortfall when needed
  const shortfall = useMemo(() => {
    if (!selectedInputToken || !selectedInputAmount) return 0n;
    const inputAmountBigInt = parseUnits(selectedInputAmount, selectedInputToken.decimals);
    return inputAmountBigInt - (lockedBalance || 0n);
  }, [selectedInputToken, selectedInputAmount, lockedBalance]);

  // Check allowance for deposit
  const { data: allowance } = useReadContract({
    address: selectedInputToken?.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [address as `0x${string}`, '0x00000000000018DF021Ff2467dF97ff846E09f48' as `0x${string}`],
    scopeKey: 'deposit-allowance',
    query: {
      enabled: Boolean(
        selectedInputToken?.address &&
          address &&
          selectedInputToken.address !== '0x0000000000000000000000000000000000000000'
      ),
    },
  });

  // Update needsApproval state when relevant values change
  useEffect(() => {
    if (
      !selectedInputToken ||
      selectedInputToken.address === '0x0000000000000000000000000000000000000000'
    ) {
      setNeedsApproval(false);
      return;
    }

    if (shortfall > 0n && allowance !== undefined) {
      setNeedsApproval(shortfall > allowance);
    }
  }, [shortfall, allowance, selectedInputToken]);

  // State for tracking approval transaction
  const [isApproving, setIsApproving] = useState(false);

  // Function to handle token approval
  const handleApprove = async () => {
    if (!selectedInputToken || !address || !writeContractAsync || !publicClient) return;

    setIsApproving(true);
    try {
      showToast('Please confirm the approval transaction in your wallet', 'success');

      const hash = await writeContractAsync({
        address: selectedInputToken.address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: ['0x00000000000018DF021Ff2467dF97ff846E09f48' as `0x${string}`, BigInt(MAX_UINT256)],
      });

      showToast('Approval transaction submitted', 'success');

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        showToast(`Successfully approved ${selectedInputToken.symbol} for The Compact`, 'success');
      } else {
        showToast('Approval transaction failed', 'error');
      }
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes('user rejected')) {
        showToast('Approval transaction rejected.', 'error');
      } else {
        showToast('Failed to approve token', 'error');
        console.error('Approval error:', error);
      }
    } finally {
      setIsApproving(false);
    }
  };

  // State for tracking deposit transaction
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWaitingForFinalization, setIsWaitingForFinalization] = useState(false);

  // Get finalization threshold from health check
  const { chainInfo } = useHealthCheck();
  const finalizationThreshold = useMemo(() => {
    if (!chainInfo) return undefined;
    const chainData = chainInfo.get(chainId.toString());
    return chainData ? chainData.finalizationThresholdSeconds : undefined;
  }, [chainInfo, chainId]);

  // Handle deposit and swap
  const handleDepositAndSwap = async () => {
    setIsExecutingSwap(true);
    if (
      !quote?.data ||
      !quote.context ||
      !selectedInputToken ||
      !selectedInputAmount ||
      !writeContractAsync ||
      !publicClient
    ) {
      return;
    }

    try {
      setIsDepositing(true);
      setStatusMessage('Initiating deposit...');

      // Get suggested nonce first
      setStatusMessage('Getting suggested nonce...');
      const suggestedNonce = await smallocator.getSuggestedNonce(chainId.toString());

      // Calculate deposit parameters
      const inputAmount = parseUnits(selectedInputAmount, selectedInputToken.decimals);
      const duration = Math.min(
        540,
        resetPeriodToSeconds(formValues.resetPeriod || ResetPeriod.TenMinutes)
      );

      // Calculate the shortfall - this is what we need to deposit
      const shortfallAmount = inputAmount - (lockedBalance || 0n);

      // Calculate the proper claim hash
      const claimHash = deriveClaimHash(
        quote.data.arbiter,
        quote.data.sponsor,
        suggestedNonce,
        quote.data.expires,
        quote.data.id,
        quote.data.amount,
        {
          ...quote.data.mandate,
          salt: quote.data.mandate.salt.startsWith('0x')
            ? (quote.data.mandate.salt as `0x${string}`)
            : (`0x${quote.data.mandate.salt}` as `0x${string}`),
        }
      );

      const idsAndAmounts = [[BigInt(quote.data.id), shortfallAmount]] as [bigint, bigint][];
      const claimHashesAndTypehashes = [
        [
          claimHash,
          '0x27f09e0bb8ce2ae63380578af7af85055d3ada248c502e2378b85bc3d05ee0b0' as `0x${string}`,
        ],
      ] as [`0x${string}`, `0x${string}`][];

      // Store the nonce to use in the final smallocator call
      const finalNonce = suggestedNonce;

      // Submit deposit transaction
      const hash = await writeContractAsync({
        address: '0x00000000000018DF021Ff2467dF97ff846E09f48',
        abi: [
          {
            inputs: [
              {
                internalType: 'uint256[2][]',
                name: 'idsAndAmounts',
                type: 'uint256[2][]',
              },
              {
                internalType: 'bytes32[2][]',
                name: 'claimHashesAndTypehashes',
                type: 'bytes32[2][]',
              },
              {
                internalType: 'uint256',
                name: 'duration',
                type: 'uint256',
              },
            ],
            name: 'depositAndRegister',
            outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
            stateMutability: 'payable',
            type: 'function',
          },
        ],
        functionName: 'depositAndRegister',
        args: [idsAndAmounts, claimHashesAndTypehashes, BigInt(duration)],
        // Include value only for native token
        value:
          selectedInputToken.address === '0x0000000000000000000000000000000000000000'
            ? shortfallAmount
            : 0n,
      });

      setStatusMessage('Waiting for deposit confirmation...');

      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status !== 'success') {
        throw new Error('Deposit transaction failed');
      }

      // Get block info and calculate finalization time
      const depositBlock = await publicClient.getBlock({ blockTag: 'latest' });
      const targetTimestamp = Number(depositBlock.timestamp) + (finalizationThreshold || 0);
      setIsWaitingForFinalization(true);
      setStatusMessage('Waiting for finalization...');

      // Start polling for finalization by checking latest block
      const pollInterval = setInterval(async () => {
        try {
          const latestBlock = await publicClient.getBlock({ blockTag: 'latest' });
          if (Number(latestBlock.timestamp) >= targetTimestamp) {
            clearInterval(pollInterval);
            setIsWaitingForFinalization(false);
            console.log('Deposit finalized, requesting allocation...');
            // Helper function for exponential backoff retries
            const retryWithBackoff = async () => {
              const delays = [0, 1000, 2000, 4000, 8000]; // Initial + 4 retries with exponential backoff

              for (let attempt = 0; attempt < delays.length; attempt++) {
                try {
                  // Wait for the delay (except for first attempt)
                  if (attempt > 0) {
                    console.log(`Waiting ${delays[attempt] / 1000} seconds before attempt ${attempt + 1}...`);
                    setStatusMessage(`Retrying in ${delays[attempt] / 1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, delays[attempt]));
                  }
                  
                  console.log(`Making attempt ${attempt + 1} of ${delays.length}...`);
                  setStatusMessage(attempt === 0 ? 'Attempting swap...' : `Attempt ${attempt + 1}...`);
                  
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

                  // Use the stored nonce when making the smallocator request
                  const smallocatorRequest = {
                      chainId: quote.data.mandate.chainId.toString(),
                      compact: {
                      arbiter: quote.data.arbiter,
                      sponsor: quote.data.sponsor,
                      nonce: finalNonce,
                      expires: quote.data.expires,
                      id: quote.data.id,
                      amount: quote.data.amount,
                      witnessHash: quote.context.witnessHash,
                      witnessTypeString:
                        'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
                    },
                  };

                  console.log('Making request to smallocator with stored nonce:', smallocatorRequest);
                  const { signature } = await smallocator.submitCompact(smallocatorRequest, { isDepositAndSwap: true });

                  // Proceed with broadcast using the signature and stored nonce
                  const broadcastPayload: CompactRequestPayload = {
                    chainId: chainId.toString(),
                    compact: {
                      ...compactMessage,
                      nonce: finalNonce,
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
                    '0x', // Empty user signature since we're using deposit
                    signature,
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
                  console.log('Attempt successful!');
                  return; // Success, exit the retry loop
                } catch (error) {
                  console.error(`Attempt ${attempt + 1} failed:`, error);
                  
                  // Only show error and update UI state on final attempt
                  if (attempt === delays.length - 1) {
                    console.error('All retry attempts exhausted');
                    throw error;
                  }
                }
              }
            };

            // Start the retry process
            await retryWithBackoff();
          }
        } catch (error) {
          console.error('Error polling for finalization:', error);
          // Don't clear the interval - keep trying
        }
      }, 1000);

      // Set up cleanup in case component unmounts
      return () => clearInterval(pollInterval);
    } catch (error) {
      // Handle errors from either deposit or retry process
      console.error('Error:', error);
      setStatusMessage('');
      if (isWaitingForFinalization) {
        // Error from retry process
        setErrorMessage(error instanceof Error ? error.message : 'Failed to execute trade');
        showToast(error instanceof Error ? error.message : 'Failed to execute trade', 'error');
      } else {
        // Error from deposit process
        if (error instanceof Error && error.message.toLowerCase().includes('user rejected')) {
          setErrorMessage('Deposit confirmation rejected.');
          showToast('Deposit confirmation rejected.', 'error');
        } else {
          const errorMsg = error instanceof Error ? error.message : 'Failed to deposit tokens';
          setErrorMessage(errorMsg);
          showToast(errorMsg, 'error');
        }
      }
      setIsDepositing(false);
      setIsWaitingForFinalization(false);
      setIsExecutingSwap(false);
    }
  };

  return (
    <TradeFormUI
      isConnected={isConnected}
      isAuthenticated={isAuthenticated}
      isApproving={isApproving}
      isDepositing={isDepositing}
      isWaitingForFinalization={isWaitingForFinalization}
      isSigning={isSigning}
      isExecutingSwap={isExecutingSwap}
      isLoading={isLoading}
      chainId={chainId}
      selectedInputChain={selectedInputChain}
      selectedOutputChain={selectedOutputChain}
      selectedInputAmount={selectedInputAmount}
      selectedInputToken={selectedInputToken}
      selectedOutputToken={selectedOutputToken}
      formValues={formValues}
      quote={quote}
      error={error}
      errorMessage={errorMessage}
      statusMessage={statusMessage}
      settingsVisible={settingsVisible}
      ethereumOutputModalVisible={ethereumOutputModalVisible}
      depositModalVisible={depositModalVisible}
      needsApproval={needsApproval}
      lockedBalance={lockedBalance}
      lockedIncludingAllocated={lockedIncludingAllocated}
      unlockedBalance={unlockedBalance}
      inputTokens={inputTokens}
      outputTokens={outputTokens}
      onSignIn={signIn}
      onApprove={handleApprove}
      onSwap={handleSwap}
      onDepositAndSwap={handleDepositAndSwap}
      setSettingsVisible={setSettingsVisible}
      onEthereumOutputModalClose={() => setEthereumOutputModalVisible(false)}
      onDepositModalClose={() => setDepositModalVisible(false)}
      onValuesChange={handleValuesChange}
      onChainSwitch={() => {
        // Check if trying to swap Ethereum to be the output chain
        if ((isConnected ? chainId : selectedInputChain) === 1) {
          setEthereumOutputModalVisible(true);
          return;
        }

        if (isConnected) {
          // If connected, we need to switch the actual network
          const currentChainId = chainId;
          const targetChainId = selectedOutputChain;

          // Store current tokens and form values before the swap
          // These will be swapped: input becomes output, output becomes input
          const currentInputToken = selectedInputToken;  // Store current input to become new output
          const currentOutputToken = selectedOutputToken;  // Store current output to become new input
          const currentFormValues = {
            inputToken: formValues.inputToken,  // Store current input token ID to become new output
            outputToken: formValues.outputToken,  // Store current output token ID to become new input
          };

          // Clear tokens first to avoid any chain mismatch issues during chain switch
          setSelectedInputToken(undefined);
          setSelectedOutputToken(undefined);
          setFormValues(prev => ({
            ...prev,
            inputToken: '',
            outputToken: '',
          }));

          // Switch to the output chain (it will become the new input chain)
          switchChain?.({ chainId: targetChainId });

          // Swap the chains: output chain becomes input, input chain becomes output
          setSelectedInputChain(targetChainId);  // Current output chain becomes new input
          setSelectedOutputChain(currentChainId);  // Current input chain becomes new output

          // Set the tokens after a small delay to ensure chain state is updated
          setTimeout(() => {
            // Update form values with swapped tokens first
            setFormValues(prev => ({
              ...prev,
              inputToken: currentFormValues.outputToken,
              outputToken: currentFormValues.inputToken,
              inputAmount: quote ? prev.inputAmount : '',
            }));

            // Then set the tokens
            setSelectedInputToken(currentOutputToken);
            setSelectedOutputToken(currentInputToken);

            // Update quote params if we have a quote
            if (quote && currentInputToken && currentOutputToken) {
              setQuoteParams(prev => ({
                ...prev!,
                inputToken: currentOutputToken.address,
                outputToken: currentInputToken.address,
                inputAmount: selectedInputAmount,
              }));
            } else {
              setQuoteParams(undefined);
            }
          }, 50);
        } else {
          // Not connected, just swap the selected chains
          const tempChain = selectedInputChain;
          setSelectedInputChain(selectedOutputChain);  // Output chain becomes input
          setSelectedOutputChain(tempChain);  // Input chain becomes output

          // Store tokens before swapping
          const tempInputToken = selectedInputToken;  // Store current input to become new output
          const tempOutputToken = selectedOutputToken;  // Store current output to become new input

          // Swap tokens with null checks
          if (tempOutputToken) {
            setSelectedInputToken(tempOutputToken);  // Current output becomes new input
          }
          if (tempInputToken) {
            setSelectedOutputToken(tempInputToken);  // Current input becomes new output
          }

          // Update form values with swapped tokens
          setFormValues(prev => ({
            ...prev,
            inputToken: prev.outputToken,  // Output token ID becomes input
            outputToken: prev.inputToken,  // Input token ID becomes output
            inputAmount: quote ? prev.inputAmount : '',  // Preserve amount if we have a quote
          }));

          // Update quote params if we have a quote and both tokens
          if (quote && tempInputToken && tempOutputToken) {
            setQuoteParams(prev => ({
              ...prev!,
              inputToken: tempOutputToken.address,  // Use stored output token as new input
              outputToken: tempInputToken.address,  // Use stored input token as new output
              inputAmount: selectedInputAmount,
            }));
          } else {
            setQuoteParams(undefined);
          }
        }
      }}
      onInputChainChange={(chainId) => {
        setSelectedInputChain(Number(chainId));
        // Clear input token and quote when changing chains
        setSelectedInputToken(undefined);
        setQuoteParams(undefined);
        setFormValues(prev => ({ ...prev, inputToken: '', inputAmount: '' }));

        // If the input chain would be the same as the output chain,
        // select the next available chain, preferring Unichain
        if (chainId === selectedOutputChain) {
          const availableChains = SUPPORTED_CHAINS.filter(
            chain => chain.id !== chainId
          );
          const unichain = availableChains.find(chain => chain.id === 130);
          setSelectedOutputChain(unichain ? unichain.id : availableChains[0].id);
        }
      }}
      onOutputChainChange={(value) => {
        const newChainId = Number(value);
        if (newChainId !== selectedOutputChain) {
          setSelectedOutputChain(newChainId);
          setSelectedOutputToken(undefined);
          // Clear quote parameters when output chain changes
          setQuoteParams(undefined);
          setFormValues(prev => ({ ...prev, outputToken: '' }));
        }
      }}
      formatBalanceDisplay={formatBalanceDisplay}
    />
  );
}
