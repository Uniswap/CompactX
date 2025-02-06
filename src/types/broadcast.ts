import { Hex } from 'viem';

/**
 * Mandate structure used in broadcast requests
 */
export interface BroadcastMandate {
  chainId: number;
  tribunal: string;
  recipient: string;
  expires: string;
  token: string;
  minimumAmount: string;
  baselinePriorityFee: string;
  scalingFactor: string;
  salt: Hex;
}

/**
 * Compact message structure used in broadcast requests
 */
export interface BroadcastCompactMessage {
  arbiter: string;
  sponsor: string;
  nonce: string | null;
  expires: string;
  id: string;
  amount: string;
  mandate: BroadcastMandate;
  witnessHash?: string;
  witnessTypeString?: string;
}

/**
 * Additional context information for the broadcast request
 */
export interface BroadcastContext {
  // Quote-related information
  dispensation: string; // Amount of native tokens paid to relay the cross-chain message
  dispensationUSD: string; // USD value of the dispensation
  spotOutputAmount: string; // Implied amount of tokens received at spot price
  quoteOutputAmountDirect: string; // Direct quote amount not including dispensation
  quoteOutputAmountNet: string; // Net amount after dispensation fees

  // Lock parameters
  allocatorId: string; // ID of the allocator handling the swap
  resetPeriod: number; // Reset period for the lock
  isMultichain: boolean; // Flag indicating if the resource lock supports multichain compacts

  // Slippage information
  slippageBips: number; // User-provided slippage parameter in basis points

  // Witness information
  witnessTypeString: string; // EIP-712 type string for the mandate witness
  witnessHash: string; // Hash of the mandate witness
  tribunal: string;
}

/**
 * The main broadcast request payload structure
 */
export interface BroadcastRequest {
  finalPayload: {
    chainId: string;
    compact: BroadcastCompactMessage;
    sponsorSignature: string;
    allocatorSignature: string;
    context: BroadcastContext;
  };
}
