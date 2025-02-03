import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useCustomTokens } from '../hooks/useCustomTokens';
import { useAccount } from 'wagmi';
import type { UseAccountReturnType } from 'wagmi';

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  createConfig: () => ({
    chains: [],
    transports: {},
  }),
  WagmiConfig: ({ children }: { children: React.ReactNode }) => children,
}));

describe('useCustomTokens', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890';
  const mockToken = {
    chainId: 1,
    address: '0x2222222222222222222222222222222222222222',
    name: 'Test Token',
    symbol: 'TEST',
    decimals: 18,
  };

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Mock useAccount to return an address
    vi.mocked(useAccount).mockReturnValue({
      address: mockAddress,
      addresses: [mockAddress],
      chain: undefined,
      chainId: 1,
      connector: undefined,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      isReconnecting: false,
      status: 'connected',
    } as unknown as UseAccountReturnType);
  });

  it('should add a custom token', () => {
    const { result } = renderHook(() => useCustomTokens());

    act(() => {
      result.current.addCustomToken(mockToken);
    });

    expect(result.current.getCustomTokens(1)).toHaveLength(1);
    expect(result.current.getCustomTokens(1)[0]).toEqual(mockToken);
  });

  it('should not add duplicate tokens', () => {
    const { result } = renderHook(() => useCustomTokens());

    act(() => {
      result.current.addCustomToken(mockToken);
      result.current.addCustomToken(mockToken);
    });

    expect(result.current.getCustomTokens(1)).toHaveLength(1);
  });

  it('should remove a custom token', () => {
    const { result } = renderHook(() => useCustomTokens());

    act(() => {
      result.current.addCustomToken(mockToken);
    });

    expect(result.current.getCustomTokens(1)).toHaveLength(1);

    act(() => {
      result.current.removeCustomToken(1, mockToken.address);
    });

    expect(result.current.getCustomTokens(1)).toHaveLength(0);
  });

  it('should persist tokens in localStorage', () => {
    const { result, unmount } = renderHook(() => useCustomTokens());

    act(() => {
      result.current.addCustomToken(mockToken);
    });

    // Verify the token was saved to localStorage
    const storedTokens = localStorage.getItem(`compactx_custom_tokens_${mockAddress}`);
    expect(storedTokens).toBeTruthy();
    expect(JSON.parse(storedTokens!)[1]).toHaveLength(1);
    expect(JSON.parse(storedTokens!)[1][0]).toEqual(mockToken);

    // Unmount and remount the hook to test persistence
    unmount();

    const { result: newResult } = renderHook(() => useCustomTokens());

    // Verify the token was loaded from localStorage
    expect(newResult.current.getCustomTokens(1)).toHaveLength(1);
    expect(newResult.current.getCustomTokens(1)[0]).toEqual(mockToken);
  });

  it('should handle multiple chains', () => {
    const { result } = renderHook(() => useCustomTokens());
    const mockToken2 = { ...mockToken, chainId: 2 };

    act(() => {
      result.current.addCustomToken(mockToken); // Chain 1
      result.current.addCustomToken(mockToken2); // Chain 2
    });

    expect(result.current.getCustomTokens(1)).toHaveLength(1);
    expect(result.current.getCustomTokens(2)).toHaveLength(1);
    expect(result.current.getCustomTokens(3)).toHaveLength(0);
  });
});
