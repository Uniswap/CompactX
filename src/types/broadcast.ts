export interface BroadcastMandate {
  chainId: number;
  tribunal: string;
  recipient: string;
  expires: string;
  token: string;
  minimumAmount: string;
  baselinePriorityFee: string;
  scalingFactor: string;
  salt: string;
}

export interface BroadcastContext {
  dispensation?: string;
  dispensationUSD?: string;
  spotOutputAmount?: string;
  quoteOutputAmountDirect?: string;
  quoteOutputAmountNet?: string;
  deltaAmount?: string;
  witnessHash?: string;
  witnessTypeString?: string;
}

export interface BroadcastRequest {
  finalPayload: {
    chainId: string;
    compact: {
      arbiter: string;
      sponsor: string;
      nonce: string | null;
      expires: string;
      id: string;
      amount: string;
      mandate: BroadcastMandate;
    };
    sponsorSignature: string;
    allocatorSignature: string;
    context?: BroadcastContext;
  };
}
