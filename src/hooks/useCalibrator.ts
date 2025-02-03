import { useQuery } from '@tanstack/react-query';

interface CalibratorQuote {
  // TODO: Define quote response type
  price: string;
  gasCost: string;
  route: string[];
}

interface GetQuoteParams {
  inputToken: string;
  outputToken: string;
  amount: string;
  slippageTolerance: number;
}

export function useCalibrator() {
  const getQuote = async ({
    inputToken,
    outputToken,
    amount,
    slippageTolerance,
  }: GetQuoteParams): Promise<CalibratorQuote> => {
    // TODO: Replace with actual Calibrator API endpoint
    const response = await fetch(`${process.env.VITE_CALIBRATOR_API_URL}/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputToken,
        outputToken,
        amount,
        slippageTolerance,
      }),
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
      enabled: !!params,
    });
  };

  return {
    getQuote,
    useQuote,
  };
}
