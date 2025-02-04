import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { useTokens } from '../hooks/useTokens'; // Assuming this is where useTokens is defined
import type { CalibratorQuoteResponse, GetQuoteParams } from '../types';

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

export function useCalibrator() {
  const { address } = useAccount();
  const { inputTokens } = useTokens();

  const getQuote = async (params: GetQuoteParams): Promise<CalibratorQuoteResponse> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    // Find input token to get decimals
    const inputToken = inputTokens.find(
      token => token.address.toLowerCase() === params.inputTokenAddress.toLowerCase()
    );

    if (!inputToken) {
      throw new Error('Input token not found');
    }

    // Scale input amount by token decimals
    const scaledAmount = (
      BigInt(params.inputTokenAmount) *
      BigInt(10) ** BigInt(inputToken.decimals)
    ).toString();

    const quoteRequest: CalibratorQuoteRequest = {
      sponsor: address,
      inputTokenChainId: params.inputTokenChainId,
      inputTokenAddress: params.inputTokenAddress,
      inputTokenAmount: scaledAmount,
      outputTokenChainId: params.outputTokenChainId,
      outputTokenAddress: params.outputTokenAddress,
      lockParameters: {
        allocatorId: params.allocatorId || '0',
        resetPeriod: 0,
        isMultichain: false,
      },
      context: {
        slippageBips: params.slippageBips,
        recipient: address,
        baselinePriorityFee: '0',
        scalingFactor: '1000000000100000000',
        expires: Math.floor(Date.now() / 1000 + 300).toString(), // 5 minutes from now
      },
    };

    const response = await fetch(`${import.meta.env.VITE_CALIBRATOR_API_URL}/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(quoteRequest),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch quote');
    }

    return response.json();
  };

  const useQuote = (params: GetQuoteParams | undefined) => {
    return useQuery({
      queryKey: ['quote', params],
      queryFn: () => getQuote(params!),
      enabled: !!params && !!address,
    });
  };

  return {
    getQuote,
    useQuote,
  };
}
