export interface Token {
  chainId?: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

export interface CustomToken extends Token {
  chainId: number; // Required for custom tokens
}

export interface CalibratorQuoteResponse {
  data: {
    arbiter: string;
    sponsor: string;
    nonce: string | null;
    expires: string;
    id: string;
    amount: string;
    mandate: {
      chainId: number;
      tribunal: string;
      recipient: string;
      expires: string;
      token: string;
      minimumAmount: string;
      baselinePriorityFee: string;
      scalingFactor: string;
      salt: string;
    };
  };
  context: {
    dispensation: string;
    dispensationUSD: string;
    spotOutputAmount: string;
    quoteOutputAmountDirect: string;
    quoteOutputAmountNet: string;
    deltaAmount: string;
    witnessHash: string;
  };
}

export type AllocatorType = 'AUTOCATOR' | 'SMALLOCATOR' | 'ONEBALANCE';

export interface GetQuoteParams {
  inputTokenChainId: number;
  inputTokenAddress: string;
  inputTokenAmount: string;
  outputTokenChainId: number;
  outputTokenAddress: string;
  slippageBips: number;
  allocatorId?: string;
  resetPeriod?: number;
  isMultichain?: boolean;
  sponsor?: string;
  baselinePriorityFee?: string;
  timestamp?: number;
}
