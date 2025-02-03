import { renderHook } from '@testing-library/react';
import { useCompactMessage } from '../hooks/useCompactMessage';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useAccount, type Connector } from 'wagmi';
import { type GetAccountReturnType } from '@wagmi/core';
import { type Chain } from 'viem';

// Mock wagmi's useAccount hook
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
}));

describe('useCompactMessage', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890';
  const mockParams = {
    arbiter: '0xabcdef0123456789abcdef0123456789abcdef01',
    inputTokenAmount: '1000000000000000000',
    inputTokenAddress: '0x2222222222222222222222222222222222222222',
    outputTokenAddress: '0x3333333333333333333333333333333333333333',
    chainId: 1,
    expirationTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  };

  beforeEach(() => {
    // Setup mock for useAccount
    const mockConnector = {
      id: 'mock',
      name: 'Mock Connector',
      type: 'mock',
    } as unknown as Connector;

    const mockChain = {
      id: 1,
      name: 'Mock Chain',
    } as unknown as Chain;

    vi.mocked(useAccount).mockReturnValue({
      address: mockAddress as `0x${string}`,
      addresses: [mockAddress] as readonly [`0x${string}`, ...`0x${string}`[]],
      chain: mockChain,
      chainId: 1,
      connector: mockConnector,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      isReconnecting: false,
      status: 'connected',
    } as GetAccountReturnType);
  });

  describe('assembleMessagePayload', () => {
    it('should create a valid compact message payload', () => {
      const { result } = renderHook(() => useCompactMessage());
      const payload = result.current.assembleMessagePayload(mockParams);

      expect(payload).toMatchObject({
        chainId: '1',
        compact: {
          arbiter: mockParams.arbiter,
          sponsor: mockAddress,
          amount: mockParams.inputTokenAmount,
          expires: mockParams.expirationTime.toString(),
          id: mockParams.inputTokenAddress,
          nonce: '',
          witnessTypeString: 'CrossChainSwap(address inputToken,address outputToken)',
        },
      });

      // Verify the witness hash is a valid bytes32
      expect(payload.compact.witnessHash).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('should throw if required fields are missing', () => {
      const { result } = renderHook(() => useCompactMessage());
      const invalidParams = { ...mockParams, arbiter: '' };

      expect(() => result.current.assembleMessagePayload(invalidParams)).toThrow(
        'Missing required fields for compact message'
      );
    });

    it('should throw if amount is not positive', () => {
      const { result } = renderHook(() => useCompactMessage());
      const invalidParams = { ...mockParams, inputTokenAmount: '0' };

      expect(() => result.current.assembleMessagePayload(invalidParams)).toThrow(
        'Input amount must be positive'
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
        arbiter: '0xinvalid',
      };

      expect(() => result.current.assembleMessagePayload(invalidParams)).toThrow(
        'Invalid address format'
      );
    });
  });

  describe('createEIP712Payload', () => {
    it('should create a valid EIP712 payload', () => {
      const { result } = renderHook(() => useCompactMessage());
      const compactPayload = result.current.assembleMessagePayload(mockParams);
      const smallocatorSignature = '0x1234';
      const eip712Payload = result.current.createEIP712Payload(
        compactPayload.compact,
        smallocatorSignature,
        mockParams.chainId
      );

      expect(eip712Payload).toMatchObject({
        domain: {
          name: 'The Compact',
          version: '1',
          chainId: mockParams.chainId,
          verifyingContract: '0x00000000000018DF021Ff2467dF97ff846E09f48',
        },
        message: {
          ...compactPayload.compact,
          smallocatorSignature,
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
            { name: 'nonce', type: 'bytes32' },
            { name: 'expires', type: 'uint256' },
            { name: 'id', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'witnessTypeString', type: 'string' },
            { name: 'witnessHash', type: 'bytes32' },
            { name: 'smallocatorSignature', type: 'bytes' },
          ],
        },
      });
    });
  });
});
