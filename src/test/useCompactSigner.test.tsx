import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { useCompactSigner } from '../hooks/useCompactSigner';
import * as smallocatorModule from '../api/smallocator';
import { CompactRequestPayload } from '../types/compact';
import React from 'react';

// Mock wagmi/core
vi.mock('@wagmi/core', () => ({
  signTypedData: vi.fn().mockResolvedValue('0xUserSignature'),
  getConnectorClient: vi.fn().mockResolvedValue({
    request: vi.fn().mockResolvedValue('0xUserSignature'),
  }),
}));

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useChainId: () => 1,
  useSignTypedData: () => ({
    signTypedData: vi.fn().mockResolvedValue('0xUserSignature'),
    isLoading: false,
    error: null,
  }),
  useAccount: () => ({
    address: '0x1234567890123456789012345678901234567890',
    isConnected: true,
  }),
  http: () => ({
    request: vi.fn(),
  }),
}));

// Mock smallocator
vi.mock('../api/smallocator', () => ({
  smallocator: {
    submitCompact: vi.fn().mockResolvedValue({
      signature: '0xSmallSignature',
      nonce: '0x0000000000000000000000000000000000000000000000000000000000000000',
    }),
  },
}));

// Create a simple wrapper component
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useCompactSigner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should sign a compact message', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCompactSigner(), { wrapper });

    const mockCompact: CompactRequestPayload & { tribunal: string } = {
      chainId: '1',
      tribunal: '0x6234567890123456789012345678901234567890',
      compact: {
        arbiter: '0x1234567890123456789012345678901234567890',
        sponsor: '0x2234567890123456789012345678901234567890',
        nonce: null,
        expires: '1732520000',
        id: '0x3234567890123456789012345678901234567890',
        amount: '1000000000000000000',
        mandate: {
          recipient: '0x4234567890123456789012345678901234567890',
          expires: '1732520000',
          token: '0x5234567890123456789012345678901234567890',
          minimumAmount: '1000000000000000000',
          baselinePriorityFee: '1000000000',
          scalingFactor: '1000000000',
          salt: '0x0000000000000000000000000000000000000000000000000000000000000000',
        },
      },
    };

    const signature = await result.current.signCompact(mockCompact);

    expect(smallocatorModule.smallocator.submitCompact).toHaveBeenCalledWith(mockCompact);
    expect(signature).toEqual({
      userSignature: '0xUserSignature',
      smallocatorSignature: '0xSmallSignature',
      nonce: '0x0000000000000000000000000000000000000000000000000000000000000000',
    });
  });

  it('should handle errors from smallocator', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCompactSigner(), { wrapper });

    // Mock submitCompact to throw an error
    vi.mocked(smallocatorModule.smallocator.submitCompact).mockRejectedValue(
      new Error('Smallocator error')
    );

    const mockCompact: CompactRequestPayload & { tribunal: string } = {
      chainId: '1',
      tribunal: '0x6234567890123456789012345678901234567890',
      compact: {
        arbiter: '0x1234567890123456789012345678901234567890',
        sponsor: '0x2234567890123456789012345678901234567890',
        nonce: null,
        expires: '1732520000',
        id: '0x3234567890123456789012345678901234567890',
        amount: '1000000000000000000',
        mandate: {
          recipient: '0x4234567890123456789012345678901234567890',
          expires: '1732520000',
          token: '0x5234567890123456789012345678901234567890',
          minimumAmount: '1000000000000000000',
          baselinePriorityFee: '1000000000',
          scalingFactor: '1000000000',
          salt: '0x0000000000000000000000000000000000000000000000000000000000000000',
        },
      },
    };

    await expect(result.current.signCompact(mockCompact)).rejects.toThrow('Smallocator error');
  });
});
