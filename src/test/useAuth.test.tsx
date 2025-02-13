import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAccount, useSignMessage, WagmiConfig } from 'wagmi';
import type { UseAccountReturnType, UseSignMessageReturnType } from 'wagmi';
import { useAuth } from '../hooks/useAuth';
import { smallocator } from '../api/smallocator';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../contexts/AuthContext';
import { config } from '../config/wallet';

// Mock environment variables
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
vi.stubEnv('VITE_SMALLOCATOR_URL', process.env.VITE_SMALLOCATOR_URL);

// Mock wagmi hooks
vi.mock('wagmi', async () => {
  const actual = await vi.importActual('wagmi');
  return {
    ...actual,
    useAccount: vi.fn(),
    useSignMessage: vi.fn(),
  };
});

// Create a wrapper component for testing
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={config}>
        <AuthProvider>{children}</AuthProvider>
      </WagmiConfig>
    </QueryClientProvider>
  );
};

describe('useAuth Hook', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    smallocator.setTestSessionId(null);

    // Default useAccount mock
    vi.mocked(useAccount).mockReturnValue({
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      addresses: ['0x1234567890123456789012345678901234567890'] as readonly `0x${string}`[],
      chainId: 10,
      chain: undefined,
      connector: undefined,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      isReconnecting: false,
      status: 'connected' as const,
    } as unknown as UseAccountReturnType);

    // Default useSignMessage mock
    vi.mocked(useSignMessage).mockReturnValue({
      signMessageAsync: vi.fn().mockResolvedValue('0xsignature'),
      signMessage: vi.fn(),
      data: undefined,
      error: null,
      isError: false,
      isIdle: true,
      isPending: false,
      isSuccess: false,
      reset: vi.fn(),
      status: 'idle',
      variables: undefined,
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      submittedAt: 0,
      context: undefined,
    } as unknown as UseSignMessageReturnType);

    // Mock smallocator API
    vi.mock('../api/smallocator', () => ({
      smallocator: {
        verifySession: vi.fn().mockResolvedValue({ valid: true, session: { address: '0x1234' } }),
        getSessionPayload: vi.fn().mockResolvedValue({
          session: {
            domain: 'test.com',
            address: '0x1234',
            statement: 'Sign in',
            uri: 'https://test.com',
            version: '1',
            chainId: '1',
            nonce: '123',
            issuedAt: '2025-01-01T00:00:00.000Z',
            expirationTime: '2025-01-02T00:00:00.000Z',
          },
        }),
        createSession: vi.fn().mockResolvedValue({}),
        clearSession: vi.fn().mockResolvedValue({}),
        setTestSessionId: vi.fn(),
      },
    }));
  });

  it('should initialize with no authentication', () => {
    vi.mocked(smallocator.verifySession).mockResolvedValueOnce({ valid: false, error: 'No session' });
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.address).toBe(null);
  });

  it('should initialize as authenticated if session exists', async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3600000).toISOString();
    
    vi.mocked(smallocator.verifySession).mockResolvedValueOnce({
      valid: true,
      session: {
        id: 'test-session',
        address: '0x1234567890123456789012345678901234567890',
        expiresAt,
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.address).toBe('0x1234567890123456789012345678901234567890');
    });
  });

  it('should handle sign in flow successfully', async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3600000).toISOString();

    vi.mocked(smallocator.verifySession)
      .mockResolvedValueOnce({ valid: false, error: 'No session' })
      .mockResolvedValueOnce({
        valid: true,
        session: {
          id: 'test-session',
          address: '0x1234567890123456789012345678901234567890',
          expiresAt,
        },
      });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.signIn();
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.address).toBe('0x1234567890123456789012345678901234567890');
  });

  it('should handle sign in errors', async () => {
    vi.mocked(smallocator.getSessionPayload).mockRejectedValueOnce(new Error('Failed to get session payload'));

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await act(async () => {
      try {
        await result.current.signIn();
      } catch (error) {
        console.error('Sign in error:', error);
      }
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBe('Failed to get session payload');
  });

  it('should handle sign out', async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3600000).toISOString();

    vi.mocked(smallocator.verifySession).mockResolvedValueOnce({
      valid: true,
      session: {
        id: 'test-session',
        address: '0x1234567890123456789012345678901234567890',
        expiresAt,
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.address).toBe(null);
  });

  it('should handle sign out when clearSession fails', async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3600000).toISOString();

    vi.mocked(smallocator.verifySession).mockResolvedValueOnce({
      valid: true,
      session: {
        id: 'test-session',
        address: '0x1234567890123456789012345678901234567890',
        expiresAt,
      },
    });

    vi.mocked(smallocator.clearSession).mockRejectedValueOnce(new Error('Failed to delete session'));

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.address).toBe(null);
    expect(result.current.error).toBe('Failed to delete session');
  });
});
