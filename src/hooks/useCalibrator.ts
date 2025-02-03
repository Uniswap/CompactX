import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';

interface CalibratorQuoteRequest {
  sponsor: string;
  inputTokenChainId: number;
  inputTokenAddress: string;
  inputTokenAmount: string;
  outputTokenChainId: number;
  outputTokenAddress: string;
  lockParameters: {
    allocatorId: string;
    resetPeriod: number;
    isMultichain: boolean;
  };
  context: {
    slippageBips: number;
    recipient: string;
    baselinePriorityFee: string;
    scalingFactor: string;
    expires: string;
  };
}

interface CalibratorQuoteResponse {
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

interface GetQuoteParams {
  inputTokenChainId: number;
  inputTokenAddress: string;
  inputTokenAmount: string;
  outputTokenChainId: number;
  outputTokenAddress: string;
  slippageBips: number;
  allocatorId?: string;
}

export function useCalibrator() {
  const { address } = useAccount();

  const getQuote = async ({
    inputTokenChainId,
    inputTokenAddress,
    inputTokenAmount,
    outputTokenChainId,
    outputTokenAddress,
    slippageBips,
    allocatorId = '0x000000000000000000000000', // Default allocator ID
  }: GetQuoteParams): Promise<CalibratorQuoteResponse> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    // Current timestamp + 24 hours in seconds
    const expires = Math.floor(Date.now() / 1000 + 86400).toString();

    const request: CalibratorQuoteRequest = {
      sponsor: address,
      inputTokenChainId,
      inputTokenAddress,
      inputTokenAmount,
      outputTokenChainId,
      outputTokenAddress,
      lockParameters: {
        allocatorId,
        resetPeriod: 0,
        isMultichain: false,
      },
      context: {
        slippageBips,
        recipient: address,
        baselinePriorityFee: '1000000000', // 1 gwei
        scalingFactor: '1000000000100000000', // 1.0000000001
        expires,
      },
    };

    const response = await fetch(`${process.env.VITE_CALIBRATOR_API_URL}/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch quote');
    }

    return response.json();
  };

  const useQuote = (params: GetQuoteParams | undefined) => {
    return useQuery({
      queryKey: ['calibrator', 'quote', params],
      queryFn: () => getQuote(params!),
      enabled: !!params && !!address,
    });
  };

  return {
    getQuote,
    useQuote,
  };
}
