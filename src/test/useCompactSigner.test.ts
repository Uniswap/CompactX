import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCompactSigner } from '../hooks/useCompactSigner';
import * as smallocator from '../api/smallocator';
import { useAccount, useChainId, useSignTypedData } from 'wagmi';

vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useChainId: vi.fn(),
  useSignTypedData: vi.fn(),
}));

vi.mock('../api/smallocator', () => ({
  submitCompact: vi.fn(),
}));

describe('useCompactSigner', () => {
  const mockAddress = '0xUserAddress';
  const mockChainId = 10; // Optimism
  const mockUserSignature = '0xUserSignature';
  const mockSmallSignature = '0xSmallSignature';
  const mockNonce = '1';
  const mockTribunal = '0xTribunalAddress';

  const mockMandate = {
    chainId: mockChainId,
    tribunal: mockTribunal,
    recipient: mockAddress,
    expires: '1732520000',
    token: '0xTokenAddress',
    minimumAmount: '1000000000000000000',
    baselinePriorityFee: '1000000000',
    scalingFactor: '1000000000000000000',
    salt: '0x' + '00'.repeat(32),
  };

  const mockCompactMessage = {
    arbiter: '0xArbiterAddress',
    sponsor: mockAddress,
    nonce: null,
    expires: '1732520000',
    id: '0xTokenId',
    amount: '1000000000000000000',
    mandate: mockMandate,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    (useAccount as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ address: mockAddress });
    (useChainId as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockChainId);
    (useSignTypedData as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      signTypedData: vi.fn().mockResolvedValue(mockUserSignature),
    });

    (smallocator.submitCompact as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      signature: mockSmallSignature,
      nonce: mockNonce,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should successfully sign a compact message', async () => {
    const { result } = renderHook(() => useCompactSigner());

    // Call the hook function
    const signatures = await result.current.signCompact(mockCompactMessage);

    // Verify smallocator API call
    expect(smallocator.submitCompact).toHaveBeenCalledWith({
      chainId: mockChainId.toString(),
      compact: mockCompactMessage,
    });

    // Verify EIP-712 signature request
    const { signTypedData } = useSignTypedData() as { signTypedData: ReturnType<typeof vi.fn> };
    expect(signTypedData).toHaveBeenCalledWith({
      domain: {
        name: 'The Compact',
        version: '1',
        chainId: mockChainId,
        verifyingContract: '0x00000000000018DF021Ff2467dF97ff846E09f48',
      },
      message: {
        ...mockCompactMessage,
      },
      primaryType: 'Compact',
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        Compact: [
          { name: 'arbiter', type: 'address' },
          { name: 'sponsor', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'expires', type: 'uint256' },
          { name: 'id', type: 'bytes32' },
          { name: 'amount', type: 'uint256' },
          { name: 'mandate', type: 'Mandate' },
        ],
        Mandate: [
          { name: 'chainId', type: 'uint256' },
          { name: 'tribunal', type: 'address' },
          { name: 'recipient', type: 'address' },
          { name: 'expires', type: 'uint256' },
          { name: 'token', type: 'address' },
          { name: 'minimumAmount', type: 'uint256' },
          { name: 'baselinePriorityFee', type: 'uint256' },
          { name: 'scalingFactor', type: 'uint256' },
          { name: 'salt', type: 'bytes32' },
        ],
      },
    });

    // Verify returned signatures
    expect(signatures).toEqual({
      userSignature: mockUserSignature,
      smallocatorSignature: mockSmallSignature,
      nonce: mockNonce,
    });
  });

  it('should throw error if wallet not connected', async () => {
    (useAccount as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ address: null });
    const { result } = renderHook(() => useCompactSigner());

    await expect(result.current.signCompact(mockCompactMessage)).rejects.toThrow(
      'Wallet not connected'
    );
  });

  it('should handle smallocator API errors', async () => {
    const error = new Error('API Error');
    (smallocator.submitCompact as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(error);
    const { result } = renderHook(() => useCompactSigner());

    await expect(result.current.signCompact(mockCompactMessage)).rejects.toThrow(error);
  });

  it('should handle user signature rejection', async () => {
    const error = new Error('User rejected');
    (useSignTypedData as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      signTypedData: vi.fn().mockRejectedValue(error),
    });
    const { result } = renderHook(() => useCompactSigner());

    await expect(result.current.signCompact(mockCompactMessage)).rejects.toThrow(error);
  });
});
