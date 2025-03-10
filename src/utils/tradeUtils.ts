import { encodeAbiParameters, keccak256, toBytes } from 'viem';
import type { Mandate } from '../types/compact';

// Max uint256 value for infinite approval
export const MAX_UINT256 =
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' as const;

// Supported chains for output token
export const SUPPORTED_CHAINS = [
  { id: 130, name: 'Unichain' },
  { id: 8453, name: 'Base' },
  { id: 10, name: 'Optimism' },
];

// Input chains include Ethereum
export const INPUT_CHAINS = [{ id: 1, name: 'Ethereum' }, ...SUPPORTED_CHAINS];

// Default sponsor address when wallet is not connected
export const DEFAULT_SPONSOR = '0x0000000000000000000000000000000000000000';

export enum ResetPeriod {
  OneSecond = 0,
  FifteenSeconds = 1,
  OneMinute = 2,
  TenMinutes = 3,
  OneHourAndFiveMinutes = 4,
  OneDay = 5,
  SevenDaysAndOneHour = 6,
  ThirtyDays = 7,
}

import type { AllocatorType } from '../types';

export interface TradeFormValues {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  slippageTolerance: number;
  baselinePriorityFee: number;
  resetPeriod: ResetPeriod;
  isMultichain: boolean;
  allocator: AllocatorType;
}

// Helper functions for deriving claim hash
export const deriveMandateHash = (mandate: Mandate): `0x${string}` => {
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

export const deriveClaimHash = (
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

// Format balance with proper decimals
export const formatTokenAmount = (balance: bigint | undefined, decimals: number) => {
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

// Map reset period enum to seconds for calibrator
export const resetPeriodToSeconds = (resetPeriod: ResetPeriod): number => {
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
