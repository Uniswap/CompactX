export interface Mandate {
  chainId: number;
  tribunal: string;
  recipient: string;
  expires: string;
  token: string;
  minimumAmount: string;
  baselinePriorityFee: string;
  scalingFactor: string;
  salt: `0x${string}`;
}

export interface BroadcastContext {
  dispensation?: string;
  dispensationUSD?: string;
  spotOutputAmount?: string;
  quoteOutputAmountDirect?: string;
  quoteOutputAmountNet?: string;
  deltaAmount?: string;
  witnessHash: string;
  witnessTypeString: string;
  claimHash?: string;
}

export interface BroadcastRequest {
  chainId: string;
  compact: {
    arbiter: string;
    sponsor: string;
    nonce: string | null;
    expires: string;
    id: string;
    amount: string;
    mandate: Mandate;
  };
  sponsorSignature: string;
  allocatorSignature: string;
  context: BroadcastContext;
}
