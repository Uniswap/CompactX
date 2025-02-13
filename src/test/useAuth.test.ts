import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAccount, useSignMessage } from 'wagmi';
import type { UseAccountReturnType, UseSignMessageReturnType } from 'wagmi';
import { useAuth } from '../hooks/useAuth';
import { smallocator } from '../api/smallocator';
import { TestWrapper } from './test-wrapper';

// Mock environment variables
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
vi.stubEnv('VITE_SMALLOCATOR_URL', process.env.VITE_SMALLOCATOR_URL);


// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useSignMessage: vi.fn(),
}));

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
  });

  it('should initialize with no authentication', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.address).toBe(null);
  });

  it('should initialize as authenticated if session exists', async () => {
    // Set up session ID and mock before rendering
    const sessionId = 'test-session';
    localStorage.setItem('sessionId', sessionId);
    smallocator.setTestSessionId(sessionId);

    // Mock successful session verification synchronously
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/session')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            session: {
              id: sessionId,
              address: '0x1234567890123456789012345678901234567890',
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          }),
        });
      }
      return Promise.reject(new Error('Not found'));
    });

    // Render hook
    const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

    // Wait for all state updates to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify the authentication state
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.address).toBe('0x1234567890123456789012345678901234567890');
  });

  it('should handle sign in flow successfully', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

    // Mock successful session payload request
    global.fetch = vi
      .fn()
      .mockImplementationOnce((url: string) => {
        if (url.includes('/session/10/0x1234567890123456789012345678901234567890')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              session: {
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
          });
        }
        return Promise.reject(new Error('Not found'));
      })
      // Mock successful session creation
      .mockImplementationOnce((url: string) => {
        if (url.endsWith('/session')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sessionId: 'test-session',
              valid: true,
              session: {
                id: 'test-session',
                address: '0x1234567890123456789012345678901234567890',
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
              },
            }),
          });
        }
        return Promise.reject(new Error('Not found'));
      });

    // Trigger sign in
    await act(async () => {
      await result.current.signIn();
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.address).toBe('0x1234567890123456789012345678901234567890');
    expect(localStorage.getItem('sessionId')).toBe('test-session');
  });

  it('should handle sign in errors', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

    // Mock failed session payload request
    global.fetch = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Failed to get session payload',
        }),
      });
    });

    // Trigger sign in
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
    const sessionId = 'test-session';
    localStorage.setItem('sessionId', sessionId);
    smallocator.setTestSessionId(sessionId);

    // Create a mock that tracks request order
    const fetchMock = vi.fn().mockImplementation((url: string, options?: { method: string }) => {
      if (url.endsWith('/session')) {
        // Handle DELETE request
        if (options?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          });
        }

        // Handle GET request for session verification
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            session: {
              id: sessionId,
              address: '0x1234567890123456789012345678901234567890',
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          }),
        });
      }
      return Promise.reject(new Error('Not found'));
    });

    global.fetch = fetchMock;

    const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

    // Wait for initial state to be set
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify initial authenticated state
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.address).toBe('0x1234567890123456789012345678901234567890');

    // Perform sign out
    await act(async () => {
      await result.current.signOut();
      // Wait for state updates to complete
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify final state
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.address).toBe(null);
    expect(localStorage.getItem('sessionId')).toBe(null);

    // Verify DELETE request was made
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/session'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('should handle sign out when DELETE request fails', async () => {
    const sessionId = 'test-session';
    localStorage.setItem('sessionId', sessionId);
    smallocator.setTestSessionId(sessionId);

    // Create a mock that tracks request order
    const fetchMock = vi.fn().mockImplementation((url: string, options?: { method: string }) => {
      if (url.endsWith('/session')) {
        // Handle DELETE request - simulate failure
        if (options?.method === 'DELETE') {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Failed to delete session. Please try again later.' }),
          });
        }

        // Handle GET request for session verification
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            session: {
              id: sessionId,
              address: '0x1234567890123456789012345678901234567890',
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          }),
        });
      }
      return Promise.reject(new Error('Not found'));
    });

    global.fetch = fetchMock;

    const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

    // Wait for initial state to be set
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify initial authenticated state
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.address).toBe('0x1234567890123456789012345678901234567890');

    // Perform sign out
    await act(async () => {
      await result.current.signOut();
      // Wait for state updates to complete
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify final state
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.address).toBe(null);
    expect(localStorage.getItem('sessionId')).toBe(null);
    expect(result.current.error).toBe('Failed to delete session. Please try again later.');

    // Verify DELETE request was made
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/session'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});
