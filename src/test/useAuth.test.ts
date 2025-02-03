import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '../hooks/useAuth';

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x1234567890123456789012345678901234567890',
    chainId: 10,
  }),
  useSignMessage: () => ({
    signMessageAsync: vi.fn().mockResolvedValue('0xsignature'),
  }),
}));

describe('useAuth Hook', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should initialize with no authentication', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should initialize as authenticated if session exists', async () => {
    localStorage.setItem('sessionId', 'test-session');

    // Mock successful session verification
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ valid: true }),
    });

    const { result } = renderHook(() => useAuth());

    // Wait for session verification
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  it('should handle sign in flow successfully', async () => {
    // Mock session payload response
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          payload: {
            domain: 'compactx.xyz',
            address: '0x1234567890123456789012345678901234567890',
            uri: 'https://compactx.xyz',
            statement: 'Sign in to CompactX',
            version: '1',
            chainId: 10,
            nonce: '123456',
            issuedAt: new Date().toISOString(),
            expirationTime: new Date(Date.now() + 3600000).toISOString(),
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'test-session' }),
      });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn();
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem('sessionId')).toBe('test-session');
  });

  it('should handle sign in errors', async () => {
    // Mock failed session payload response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Failed to get session payload' }),
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      try {
        await result.current.signIn();
      } catch {
        // Expected error
      }
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(localStorage.getItem('sessionId')).toBeNull();
  });

  it('should handle sign out', async () => {
    localStorage.setItem('sessionId', 'test-session');

    const { result } = renderHook(() => useAuth());

    // Wait for initial session verification
    await act(async () => {
      result.current.signOut();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem('sessionId')).toBeNull();
  });
});
