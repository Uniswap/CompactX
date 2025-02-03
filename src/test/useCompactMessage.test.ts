import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCompactMessage } from '../hooks/useCompactMessage';
import { useAccount } from 'wagmi';
import { getAddress, keccak256, encodeAbiParameters } from 'viem';

vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
}));

describe('useCompactMessage', () => {
  const mockAddress = getAddress('0x1234567890123456789012345678901234567890');
  const mockTribunal = getAddress('0x2234567890123456789012345678901234567890');
  const mockTokenAddress = getAddress('0x3234567890123456789012345678901234567890');
  const mockInputToken = getAddress('0x4234567890123456789012345678901234567890');
  const mockOutputToken = getAddress('0x5234567890123456789012345678901234567890');

  const mockMandate = {
    recipient: mockAddress,
    expires: '1732520000',
    token: mockTokenAddress,
    minimumAmount: '1000000000000000000',
    baselinePriorityFee: '1000000000',
    scalingFactor: '1000000000000000000',
    salt: ('0x' + '00'.repeat(32)) as `0x${string}`,
  };

  const mockParams = {
    inputTokenAmount: '1000000000000000000',
    inputTokenAddress: mockInputToken,
    outputTokenAddress: mockOutputToken,
    chainId: 1,
    expirationTime: Math.floor(Date.now() / 1000) + 3600,
    tribunal: mockTribunal,
    mandate: mockMandate,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    (useAccount as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ address: mockAddress });
  });

  describe('assembleMessagePayload', () => {
    it('should create a valid compact message payload', () => {
      const { result } = renderHook(() => useCompactMessage());
      const payload = result.current.assembleMessagePayload(mockParams);

      // Compute expected witness hash
      const expectedWitnessHash = keccak256(
        encodeAbiParameters(
          [
            { name: 'recipient', type: 'address' },
            { name: 'expires', type: 'uint256' },
            { name: 'token', type: 'address' },
            { name: 'minimumAmount', type: 'uint256' },
            { name: 'baselinePriorityFee', type: 'uint256' },
            { name: 'scalingFactor', type: 'uint256' },
            { name: 'salt', type: 'bytes32' },
          ],
          [
            mockMandate.recipient as `0x${string}`,
            BigInt(mockMandate.expires),
            mockMandate.token as `0x${string}`,
            BigInt(mockMandate.minimumAmount),
            BigInt(mockMandate.baselinePriorityFee),
            BigInt(mockMandate.scalingFactor),
            mockMandate.salt as `0x${string}`,
          ]
        )
      );

      expect(payload).toEqual({
        chainId: '1',
        compact: {
          arbiter: '0x00000000000018DF021Ff2467dF97ff846E09f48',
          sponsor: mockAddress,
          nonce: null,
          expires: mockParams.expirationTime.toString(),
          id: expectedWitnessHash,
          amount: mockParams.inputTokenAmount,
          mandate: mockMandate,
        },
      });
    });

    it('should throw if required fields are missing', () => {
      const { result } = renderHook(() => useCompactMessage());
      const invalidParams = { ...mockParams };
      delete (invalidParams as Partial<typeof mockParams>).inputTokenAmount;

      expect(() => result.current.assembleMessagePayload(invalidParams)).toThrow(
        'Missing required fields for compact message'
      );
    });

    it('should throw if amount is not positive', () => {
      const { result } = renderHook(() => useCompactMessage());
      const invalidParams = { ...mockParams, inputTokenAmount: '0' };

      expect(() => result.current.assembleMessagePayload(invalidParams)).toThrow(
        'Amount must be positive'
      );
    });

    it('should throw if expiration is in the past', () => {
      const { result } = renderHook(() => useCompactMessage());
      const invalidParams = {
        ...mockParams,
        expirationTime: Math.floor(Date.now() / 1000) - 3600,
      };

      expect(() => result.current.assembleMessagePayload(invalidParams)).toThrow(
        'Expiration time must be in the future'
      );
    });

    it('should throw if addresses are invalid', () => {
      const { result } = renderHook(() => useCompactMessage());
      const invalidParams = {
        ...mockParams,
        inputTokenAddress: 'invalid-address',
      };

      expect(() => result.current.assembleMessagePayload(invalidParams)).toThrow(
        'Invalid address format'
      );
    });
  });
});
