export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  logoURI?: string;
}

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
}
