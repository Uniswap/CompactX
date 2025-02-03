import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCompactSigner } from '../hooks/useCompactSigner';
import { useSignTypedData } from 'wagmi';
import * as smallocatorModule from '../api/smallocator';
import { CompactRequestPayload } from '../types/compact';

vi.mock('wagmi', () => ({
  useSignTypedData: vi.fn(),
}));

vi.mock('../api/smallocator', () => ({
  submitCompact: vi.fn(),
}));

describe('useCompactSigner', () => {
  const mockCompactRequest: CompactRequestPayload = {
    chainId: '1',
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
        scalingFactor: '1000000000000000000',
        salt: ('0x' + '00'.repeat(32)) as `0x${string}`,
      },
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Mock submitCompact response
    const mockResponse = {
      hash: ('0x' + '00'.repeat(32)) as `0x${string}`,
      signature: ('0x' + '00'.repeat(65)) as `0x${string}`,
      nonce: ('0x' + '01'.repeat(32)) as `0x${string}`,
    };
    vi.mocked(smallocatorModule.submitCompact).mockResolvedValue(mockResponse);

    // Mock signTypedData response
    (useSignTypedData as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      signTypedData: vi.fn().mockResolvedValue('0xUserSignature'),
    });
  });

  it('should sign a compact message', async () => {
    const { result } = renderHook(() => useCompactSigner());

    const signature = await result.current.signCompact(mockCompactRequest);

    expect(smallocatorModule.submitCompact).toHaveBeenCalledWith(mockCompactRequest);

    expect(signature).toEqual({
      userSignature: '0xUserSignature',
      smallocatorSignature: ('0x' + '00'.repeat(65)) as `0x${string}`,
      nonce: ('0x' + '01'.repeat(32)) as `0x${string}`,
    });
  });

  it('should handle errors from smallocator', async () => {
    const error = new Error('Smallocator error');
    vi.mocked(smallocatorModule.submitCompact).mockRejectedValue(error);

    const { result } = renderHook(() => useCompactSigner());

    await expect(result.current.signCompact(mockCompactRequest)).rejects.toThrow(
      'Smallocator error'
    );
  });
});
