import { Select } from './Select';
import { NumberInput } from './NumberInput';
import { useToast } from '../hooks/useToast';
import { Modal } from './Modal';
import { SegmentedControl } from './SegmentedControl';
import { TooltipIcon } from './TooltipIcon';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { useAuth } from '../hooks/useAuth';
import { ConnectButton } from '../config/wallet';
import { parseUnits, type Hex, encodeAbiParameters, keccak256, toBytes } from 'viem';
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

// Helper functions for deriving claim hash
const deriveMandateHash = (mandate: Mandate): `0x${string}` => {
  const MANDATE_TYPE_STRING =
    'Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)';
  const MANDATE_TYPEHASH = keccak256(toBytes(MANDATE_TYPE_STRING));
  const encodedParameters = encodeAbiParameters(
    [
      'bytes32',
      'uint256',
      'address',
      'address',
      'uint256',
      'address',
      'uint256',
      'uint256',
      'uint256',
      'bytes32',
    ].map(type => ({ type })),
    [
      MANDATE_TYPEHASH,
      BigInt(mandate.chainId),
      mandate.tribunal as `0x${string}`,
      mandate.recipient as `0x${string}`,
      BigInt(parseInt(mandate.expires)),
      mandate.token as `0x${string}`,
      BigInt(mandate.minimumAmount),
      BigInt(mandate.baselinePriorityFee),
      BigInt(mandate.scalingFactor),
      mandate.salt as `0x${string}`,
    ]
  );

  return keccak256(encodedParameters);
};

const deriveClaimHash = (
  arbiter: string,
  sponsor: string,
  nonce: string,
  expiration: string,
  id: string,
  amount: string,
  mandate: Mandate
): `0x${string}` => {
  // First derive the mandate hash
  const mandateHash = deriveMandateHash(mandate);

  // Calculate the COMPACT_TYPEHASH
  const COMPACT_TYPE_STRING =
    'Compact(address arbiter,address sponsor,uint256 nonce,uint256 expires,uint256 id,uint256 amount,Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)';
  const COMPACT_TYPEHASH = keccak256(toBytes(COMPACT_TYPE_STRING));

  // Encode all parameters including the derived mandate hash
  const encodedParameters = encodeAbiParameters(
    [
      { type: 'bytes32' }, // COMPACT_TYPEHASH
      { type: 'address' }, // arbiter
      { type: 'address' }, // sponsor
      { type: 'uint256' }, // nonce
      { type: 'uint256' }, // expires
      { type: 'uint256' }, // id
      { type: 'uint256' }, // amount
      { type: 'bytes32' }, // mandateHash
    ],
    [
      COMPACT_TYPEHASH,
      arbiter as `0x${string}`,
      sponsor as `0x${string}`,
      BigInt(nonce),
      BigInt(expiration),
      BigInt(id),
      BigInt(amount),
      mandateHash,
    ]
  );

  return keccak256(encodedParameters);
};

// Max uint256 value for infinite approval
const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' as const;

// Supported chains for output token
const SUPPORTED_CHAINS = [
  { id: 130, name: 'Unichain' },
  { id: 8453, name: 'Base' },
  { id: 10, name: 'Optimism' },
];

// Input chains include Ethereum
const INPUT_CHAINS = [{ id: 1, name: 'Ethereum' }, ...SUPPORTED_CHAINS];

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
  ThirtyDays = 7,
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

  // Format balance with proper decimals
  const formatTokenAmount = (balance: bigint | undefined, decimals: number) => {
    if (!balance) return '0';

    // Convert to string with full precision using BigInt division
    const divisor = BigInt(10 ** decimals);
    const integerPart = balance / divisor;
    const fractionalPart = balance % divisor;

    // Pad the fractional part with leading zeros if needed
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');

    // Combine integer and fractional parts
    const fullStr = `${integerPart}${fractionalStr === '0'.repeat(decimals) ? '' : '.' + fractionalStr}`;

    // Parse to number for formatting, but limit to 8 decimal places
    const num = Number(fullStr);
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
      useGrouping: true,
    });
  };

  // Format balance display as "unlocked / total symbol"
  const formatBalanceDisplay = (
    unlockedBalance: bigint | undefined,
    lockedBalance: bigint | undefined,
    token: (typeof inputTokens)[0] | undefined
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

  // Map reset period enum to seconds for calibrator
  const resetPeriodToSeconds = (resetPeriod: ResetPeriod): number => {
    const mapping: Record<ResetPeriod, number> = {
      [ResetPeriod.OneSecond]: 1,
      [ResetPeriod.FifteenSeconds]: 15,
      [ResetPeriod.OneMinute]: 60,
      [ResetPeriod.TenMinutes]: 600,
      [ResetPeriod.OneHourAndFiveMinutes]: 3900,
      [ResetPeriod.OneDay]: 86400,
      [ResetPeriod.SevenDaysAndOneHour]: 604800,
      [ResetPeriod.ThirtyDays]: 2592000,
    };
    return mapping[resetPeriod];
  };

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
    console.log('\n=== Quote Parameters Effect Triggered ===');
    console.log('Current state:', {
      isExecutingSwap,
      selectedInputToken,
      selectedInputAmount,
      selectedOutputToken,
      selectedOutputChain,
      quoteParams
    });

    if (isExecutingSwap) {
      console.log('Skipping quote update during swap execution');
      return;
    }

    // Always clear quote params when input amount or input token changes
    if (!selectedInputToken?.address || !selectedInputAmount) {
      console.log('Missing input params:', {
        hasInputToken: !!selectedInputToken?.address,
        hasInputAmount: !!selectedInputAmount
      });
      return;
    }

    // Only proceed with setting new quote params if we have output token
    if (!selectedOutputToken?.address) {
      console.log('Missing output token, keeping quote cleared');
      return;
    }

    // Ensure we have valid chain IDs


    if (typeof selectedInputChain !== 'number' || typeof selectedOutputChain !== 'number') {
      console.log('Invalid chain IDs:', { selectedInputChain, selectedOutputChain });
      console.log('Clearing quote params');
      setQuoteParams(undefined);
      return;
    }

    console.log('All parameters valid, creating new quote params');
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
    console.log('Setting new quote params:', newParams);
    setQuoteParams(newParams);
    console.log('=== End Quote Parameters Effect ===\n');
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
      console.log('\n=== handleValuesChange Called ===');
      console.log('Field:', field);
      console.log('Value:', value);
      console.log('Current state:', {
        selectedInputToken,
        selectedInputAmount,
        selectedOutputToken,
        selectedOutputChain,
        formValues
      });
      
      // Update selected tokens if token fields change
      if (field === 'inputToken') {
        console.log('Input token change detected');
        const newInputToken = inputTokens.find(token => token.address === value);
        console.log('Found new input token:', newInputToken);
        if (newInputToken !== selectedInputToken) {
          console.log('Setting new input token');
          setSelectedInputToken(newInputToken);
        }
      } else if (field === 'outputToken') {
        console.log('Output token change detected');
        const newOutputToken = outputTokens.find(token => 
          token.address === value && token.chainId === selectedOutputChain
        );
        console.log('Found new output token:', newOutputToken);
        if (newOutputToken !== selectedOutputToken) {
          console.log('Setting new output token');
          setSelectedOutputToken(newOutputToken);
        }
      } else if (field === 'inputAmount') {
        console.log('Input amount change detected, setting to:', value);
        setSelectedInputAmount(value as string);
      }

      setFormValues(prev => {
        console.log('Updating form values from:', prev);
        const newValues = { ...prev, [field]: value };
        console.log('Updating form values to:', newValues);
        return newValues;
      });
      
      console.log('=== End handleValuesChange ===\n');
    },
    [inputTokens, outputTokens, selectedInputToken, selectedOutputToken, selectedOutputChain, formValues]
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

  // Refresh quote when wallet connects or amount changes
  // useEffect(() => {
  //   if (selectedInputAmount && (isConnected || selectedInputToken)) {
  //     // Force quote params update when amount changes or wallet connects
  //     setQuoteParams(undefined);
  //   }
  // }, [isConnected, selectedInputAmount, selectedInputToken]);

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

      // Log the relevant values
      console.log({
        lockedBalance: {
          raw: lockedBalance?.toString(),
          formatted: formatTokenAmount(lockedBalance, selectedInputToken.decimals),
        },
        inputAmount: {
          raw: parseUnits(selectedInputAmount || '0', selectedInputToken.decimals).toString(),
          formatted: selectedInputAmount,
        },
        shortfall: {
          raw: shortfall.toString(),
          formatted: formatTokenAmount(shortfall, selectedInputToken.decimals),
        },
        allowance: {
          raw: allowance.toString(),
          formatted: formatTokenAmount(allowance, selectedInputToken.decimals),
        },
        needsApproval: shortfall > allowance,
      });
    }
  }, [shortfall, allowance, selectedInputToken, lockedBalance, selectedInputAmount]);

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
      console.log('Got suggested nonce:', suggestedNonce);

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
            console.log('Deposit finalized, starting Deposit & Swap with exponential backoff...');
            // Helper function for exponential backoff retries
            async () => {
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
                  console.log(`Attempt ${attempt + 1} failed:`, error);
                  
                  // Only show error and update UI state on final attempt
                  if (attempt === delays.length - 1) {
                    console.log('All retry attempts exhausted');
                    throw error;
                  }
                }
              }
            };

            // Start the retry process
            await handleSwap({ skipSignature: true, isDepositAndSwap: true });
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
                  onChange={chainId => {
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
          {selectedInputToken &&
            formatBalanceDisplay(unlockedBalance, lockedBalance, selectedInputToken)}
        </div>

        <div className="flex justify-center -my-2 relative z-10">
          <button
            className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-gray-700 hover:bg-[#2a2a2a] flex items-center justify-center text-[#00ff00] transition-colors"
            onClick={() => {
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
                const currentInputToken = selectedInputToken;
                const currentOutputToken = selectedOutputToken;
                const currentFormValues = {
                  inputToken: formValues.inputToken,
                  outputToken: formValues.outputToken,
                };

                // Clear tokens first to avoid any chain mismatch issues
                setSelectedInputToken(undefined);
                setSelectedOutputToken(undefined);
                setFormValues(prev => ({
                  ...prev,
                  inputToken: '',
                  outputToken: '',
                }));

                // Switch to the output chain
                switchChain?.({ chainId: targetChainId });

                // Update the form to swap the chains
                setSelectedInputChain(targetChainId);
                setSelectedOutputChain(currentChainId);

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
                setSelectedInputChain(selectedOutputChain);
                setSelectedOutputChain(tempChain);

                // Swap tokens
                const tempInputToken = selectedInputToken;
                const tempOutputToken = selectedOutputToken;
                setSelectedInputToken(tempOutputToken);
                setSelectedOutputToken(tempInputToken);

                // Update form values with swapped tokens
                setFormValues(prev => ({
                  ...prev,
                  inputToken: prev.outputToken,
                  outputToken: prev.inputToken,
                  inputAmount: quote ? prev.inputAmount : '',
                }));

                // Update quote params if we have a quote
                if (quote && selectedInputToken && selectedOutputToken) {
                  setQuoteParams(prev => ({
                    ...prev!,
                    inputToken: selectedOutputToken.address,
                    outputToken: selectedInputToken.address,
                    inputAmount: selectedInputAmount,
                  }));
                } else {
                  setQuoteParams(undefined);
                }
              }
            }}
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
                onChange={value => {
                  const newChainId = Number(value);
                  if (newChainId !== selectedOutputChain) {
                    console.log('Output chain changing to:', newChainId);
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
                      return chain.id !== chainId;
                    }
                    return chain.id !== selectedInputChain;
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
                  console.log('Output token changing to:', {
                    value,
                    token: outputTokens.find(t => t.address === value)
                  });
                  handleValuesChange('outputToken', value.toString());
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
          onClose={() => setEthereumOutputModalVisible(false)}
        >
          <p className="text-white mb-4">
            Ethereum is not available as the output chain for cross-chain swaps as it does not
            enforce transaction ordering by priority fee. Please select a different output chain.
          </p>
          <div className="flex justify-end">
            <button
              onClick={() => setEthereumOutputModalVisible(false)}
              className="px-4 py-2 bg-[#00ff00]/10 hover:bg-[#00ff00]/20 border border-gray-800 text-[#00ff00] rounded-lg"
            >
              Close
            </button>
          </div>
        </Modal>

        <Modal
          title="Deposit Required"
          open={depositModalVisible}
          onClose={() => setDepositModalVisible(false)}
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
              onClick={() => setDepositModalVisible(false)}
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
            onClick={signIn}
            className="w-full h-12 rounded-lg font-medium transition-colors bg-[#00ff00]/10 hover:bg-[#00ff00]/20 text-[#00ff00] border border-[#00ff00]/20"
          >
            Sign in to Smallocator
          </button>
        ) : (
          <button
            onClick={() => {
              // If we need approval first, handle it regardless of other conditions
              if (needsApproval && selectedInputToken) {
                handleApprove();
                return;
              }

              // For deposit and swap, we need the full conditions
              if (
                selectedInputToken &&
                selectedInputAmount &&
                lockedBalance !== undefined &&
                unlockedBalance !== undefined
              ) {
                const inputAmount = parseUnits(selectedInputAmount, selectedInputToken.decimals);
                const totalBalance = lockedBalance + unlockedBalance;

                if (totalBalance < inputAmount) {
                  return; // Do nothing, button will be disabled
                } else if (lockedBalance < inputAmount) {
                  // Instead of showing the deposit modal, initiate deposit and swap
                  handleDepositAndSwap();
                  return;
                }
              }
              handleSwap({ isDepositAndSwap: false });
            }}
            disabled={(() => {
              // If we're approving, always disable
              if (isApproving) return true;

              // If we need approval and have a selected input token, enable
              if (needsApproval && selectedInputToken) return false;

              // For swap functionality, require all conditions
              if (
                !quote?.data ||
                isLoading ||
                isSigning ||
                !selectedInputToken ||
                !selectedInputAmount
              ) {
                return true;
              }

              // Check balance for swap
              if (selectedInputToken && selectedInputAmount) {
                const inputAmount = parseUnits(selectedInputAmount, selectedInputToken.decimals);
                const totalBalance = (lockedBalance || 0n) + (unlockedBalance || 0n);
                return totalBalance < inputAmount;
              }
              return true;
            })()}
            className={`w-full h-12 rounded-lg font-medium transition-colors ${(() => {
              // If we're approving, show disabled state
              if (isApproving) return 'bg-gray-700 text-gray-400 cursor-not-allowed';

              // If we need approval and have a selected input token, show enabled state
              if (needsApproval && selectedInputToken) {
                return 'bg-[#00ff00]/10 hover:bg-[#00ff00]/20 text-[#00ff00] border border-[#00ff00]/20';
              }

              // For swap functionality, check all conditions
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
              // Show approval states first
              if (isApproving) return 'Waiting for approval...';
              if (needsApproval && selectedInputToken)
                return `Approve ${selectedInputToken.symbol}`;

              // Show deposit states
              if (isDepositing && !isWaitingForFinalization) return 'Depositing...';
              if (isWaitingForFinalization) return 'Waiting for finalization...';

              // Then show other states
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
                  <TooltipIcon title="Threshold transaction gas priority fee above which the filler must provide additional output tokens. Should generally only be necessary during periods of high congestion." />
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
                  onChange={value => handleValuesChange('resetPeriod', value)}
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
    </div>
  );
}
