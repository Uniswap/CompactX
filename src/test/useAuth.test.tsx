import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useAccount, useSignMessage } from 'wagmi';
import type { UseAccountReturnType, UseSignMessageReturnType } from 'wagmi';
import { AuthProvider } from '../contexts/AuthContext';
import { useAuth } from '../hooks/useAuth';
import { smallocator } from '../api/smallocator';

// Mock environment variables
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
vi.stubEnv('VITE_SMALLOCATOR_URL', process.env.VITE_SMALLOCATOR_URL);

vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useSignMessage: vi.fn(),
}));

describe('useAuth Hook', () => {
  const sessionId = 'test-session';
  const address = '0x1234567890123456789012345678901234567890';

  beforeEach(() => {
    // Clear any existing storage and mocks
    localStorage.clear();
    vi.clearAllMocks();
    
    // Mock wagmi hooks
    vi.mocked(useAccount).mockReturnValue({
      address,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      status: 'connected',
    } as any);

    vi.mocked(useSignMessage).mockReturnValue({
      signMessageAsync: vi.fn().mockResolvedValue('0xsignature'),
      signMessage: vi.fn(),
      isError: false,
      isLoading: false,
      isSuccess: false,
    } as any);

    // Mock smallocator methods with consistent session ID
    vi.spyOn(smallocator, 'verifySession').mockImplementation(async () => {
      // Small delay to simulate network request
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        valid: true,
        session: {
          id: sessionId,
          address,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      };
    });

    vi.spyOn(smallocator, 'getSessionPayload').mockImplementation(async () => ({
      session: {
        domain: 'compactx.xyz',
        address,
        uri: 'https://compactx.xyz',
        statement: 'Sign in to CompactX',
        version: '1',
        chainId: 10,
        nonce: '123456',
        issuedAt: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 3600000).toISOString(),
      },
    }));

    vi.spyOn(smallocator, 'createSession').mockImplementation(async () => ({
      sessionId,
    }));
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    cleanup();
  });

  const wrapper = ({ children }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  it('should initialize with no authentication', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.address).toBe(null);
  });

  it('should initialize as authenticated if session exists', async () => {
    // Set up initial session state
    localStorage.setItem('sessionId', sessionId);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    // Initial state should be unauthenticated while verifying
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);

    // Wait for session verification
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for effect to run
    });

    await waitFor(
      () => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.address).toBe(address);
      },
      { timeout: 3000, interval: 100 }
    );
  });

  it('should handle sign in flow successfully', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await act(async () => {
      await result.current.signIn();
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.address).toBe(address);
    expect(localStorage.getItem('sessionId')).toBe(sessionId);
  });

  it('should handle sign in errors', async () => {
    // Mock getSessionPayload to throw an error
    vi.spyOn(smallocator, 'getSessionPayload').mockRejectedValueOnce(
      new Error('Failed to get session payload')
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await act(async () => {
      try {
        await result.current.signIn();
      } catch (error) {
        // Expected error
      }
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBe('Failed to get session payload');
  });

  it('should handle sign out', async () => {
    // Set up initial session state
    localStorage.setItem('sessionId', sessionId);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    // Wait for initial authentication
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for effect to run
    });

    await waitFor(
      () => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.address).toBe(address);
      },
      { timeout: 3000, interval: 100 }
    );

    // Perform sign out
    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.address).toBe(null);
    expect(localStorage.getItem('sessionId')).toBe(null);
  });

  it('should handle sign out when DELETE request fails', async () => {
    // Set up initial session state
    localStorage.setItem('sessionId', sessionId);

    // Mock clearSession to fail
    vi.spyOn(smallocator, 'clearSession').mockRejectedValueOnce(
      new Error('Failed to delete session')
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    // Wait for initial authentication
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for effect to run
    });

    await waitFor(
      () => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.address).toBe(address);
      },
      { timeout: 3000, interval: 100 }
    );

    // Perform sign out
    await act(async () => {
      await result.current.signOut();
    });

    // Should still clear local state even if server request fails
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.address).toBe(null);
    expect(localStorage.getItem('sessionId')).toBe(null);
    expect(result.current.error).toBe('Failed to delete session');
  });
});
