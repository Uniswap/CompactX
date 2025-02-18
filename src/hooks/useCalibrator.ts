import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { useTokens } from '../hooks/useTokens'; // Assuming this is where useTokens is defined
import type { CalibratorQuoteResponse, GetQuoteParams } from '../types/index';
import { mapSecondsToResetPeriod } from '../types/index';

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
    fillExpires: string;
    claimExpires: string;
  };
}

export function useCalibrator() {
  const { address } = useAccount();
  const { inputTokens } = useTokens();

  const getQuote = async (params: GetQuoteParams): Promise<CalibratorQuoteResponse> => {
    // Find input token to get decimals
    const inputToken = inputTokens.find(
      token => token.address.toLowerCase() === params.inputTokenAddress.toLowerCase()
    );

    if (!inputToken) {
      throw new Error('Input token not found');
    }

    // Validate sponsor is a valid address (including zero address)
    if (typeof params.sponsor !== 'string' || !params.sponsor.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new Error('Invalid sponsor address format');
    }

    const quoteRequest: CalibratorQuoteRequest = {
      sponsor: params.sponsor, // Can be zero address for unconnected wallet
      inputTokenChainId: params.inputTokenChainId,
      inputTokenAddress: params.inputTokenAddress,
      inputTokenAmount: params.inputTokenAmount,
      outputTokenChainId: params.outputTokenChainId,
      outputTokenAddress: params.outputTokenAddress,
      lockParameters: {
        allocatorId: params.allocatorId || '0',
        resetPeriod: params.resetPeriod ? mapSecondsToResetPeriod(params.resetPeriod) : 0,
        isMultichain: params.isMultichain || false,
      },
      context: {
        slippageBips: params.slippageBips,
        recipient: address || '0x0000000000000000000000000000000000000000',
        baselinePriorityFee: params.baselinePriorityFee || '0', // Value is already scaled from gwei to wei
        scalingFactor: '1000000000100000000',
        fillExpires: params.fillExpires || Math.floor(Date.now() / 1000 + 180).toString(), // Default: 3 minutes from now
        claimExpires: params.claimExpires || Math.floor(Date.now() / 1000 + 540).toString(), // Default: 9 minutes from now
      },
    };

    console.group('Calibrator Quote');
    console.log('Request:', {
      url: `${import.meta.env.VITE_CALIBRATOR_API_URL}/quote`,
      body: quoteRequest
    });

    const response = await fetch(`${import.meta.env.VITE_CALIBRATOR_API_URL}/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(quoteRequest),
    });

    if (!response.ok) {
      console.error('Quote request failed:', await response.text());
      console.groupEnd();
      throw new Error('Failed to fetch quote');
    }

    const data = await response.json();
    console.log('Response:', data);
    console.groupEnd();
    return data;
  };

  const useQuote = (params: GetQuoteParams | undefined, version: number = 0) => {
    return useQuery({
      queryKey: [
        'quote',
        params?.inputTokenChainId,
        params?.inputTokenAddress,
        params?.inputTokenAmount,
        params?.outputTokenChainId,
        params?.outputTokenAddress,
        params?.slippageBips,
        params?.allocatorId,
        params?.resetPeriod,
        params?.isMultichain,
        params?.sponsor,
        params?.baselinePriorityFee,
        version,
        // Round down to nearest 10 seconds to refresh quote periodically
        Math.floor(Date.now() / 10000) * 10000,
      ],
      queryFn: () => getQuote(params!),
      enabled: !!params,
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
      staleTime: 10000, // Consider data stale after 10 seconds
      refetchInterval: 10000, // Refetch every 10 seconds
      retry: 3, // Retry failed requests 3 times
    });
  };

  return {
    getQuote,
    useQuote,
  };
}
