export enum ResetPeriod {
  OneSecond,
  FifteenSeconds,
  OneMinute,
  TenMinutes,
  OneHourAndFiveMinutes,
  OneDay,
  SevenDaysAndOneHour,
  ThirtyDays,
}

export function mapSecondsToResetPeriod(seconds: number): ResetPeriod {
  switch (seconds) {
    case 1:
      return ResetPeriod.OneSecond;
    case 15:
      return ResetPeriod.FifteenSeconds;
    case 60:
      return ResetPeriod.OneMinute;
    case 600:
      return ResetPeriod.TenMinutes;
    case 3900: // 1 hour and 5 minutes = 65 * 60
      return ResetPeriod.OneHourAndFiveMinutes;
    case 86400: // 24 * 60 * 60
      return ResetPeriod.OneDay;
    case 608400: // (7 * 24 + 1) * 60 * 60
      return ResetPeriod.SevenDaysAndOneHour;
    case 2592000: // 30 * 24 * 60 * 60
      return ResetPeriod.ThirtyDays;
    default:
      throw new Error(`Invalid reset period: ${seconds} seconds`);
  }
}

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  logoURI?: string;
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
  fillExpires?: string;
  claimExpires?: string;
}
