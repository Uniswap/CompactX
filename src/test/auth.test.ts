import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmallocatorClient } from '../api/smallocator';
import { SessionPayload } from '../api/smallocator';

// Mock the environment variables
vi.stubEnv('VITE_SMALLOCATOR_URL', 'http://localhost:3000');

describe('Authentication Flow', () => {
  let client: SmallocatorClient;
  const mockAddress = '0x1234567890123456789012345678901234567890';
  const mockChainId = 10; // Optimism

  beforeEach(() => {
    client = new SmallocatorClient();
    // Clear localStorage before each test
    localStorage.clear();
    // Clear fetch mocks
    vi.clearAllMocks();
  });

  describe('Session Payload', () => {
    it('should fetch session payload successfully', async () => {
      const mockPayload: SessionPayload = {
        domain: 'compactx.xyz',
        address: mockAddress,
        uri: 'https://compactx.xyz',
        statement: 'Sign in to CompactX',
        version: '1',
        chainId: mockChainId,
        nonce: '123456',
        issuedAt: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 3600000).toISOString(),
      };

      // Mock the API response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session: mockPayload }),
      });

      const response = await client.getSessionPayload(mockChainId, mockAddress);

      expect(response.session).toEqual(mockPayload);
      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3000/session/${mockChainId}/${mockAddress}`,
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should handle invalid address', async () => {
      const invalidAddress = '0xinvalid';

      // Mock the API response
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Invalid address'));

      await expect(client.getSessionPayload(mockChainId, invalidAddress)).rejects.toThrow(
        'Invalid address'
      );
    });
  });

  describe('Session Creation', () => {
    it('should create session successfully', async () => {
      const mockSignature = '0xsignature';
      const mockPayload: SessionPayload = {
        domain: 'compactx.xyz',
        address: mockAddress,
        uri: 'https://compactx.xyz',
        statement: 'Sign in to CompactX',
        version: '1',
        chainId: mockChainId,
        nonce: '123456',
        issuedAt: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 3600000).toISOString(),
      };

      // Mock the API response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session: {
            id: 'mock-session-id',
          },
        }),
      });

      const response = await client.createSession({
        signature: mockSignature,
        payload: mockPayload,
      });

      expect(response.sessionId).toBe('mock-session-id');
      expect(localStorage.getItem('sessionId')).toBe('mock-session-id');
    });

    it('should handle session creation failure', async () => {
      const mockSignature = '0xsignature';
      const mockPayload: SessionPayload = {
        domain: 'compactx.xyz',
        address: mockAddress,
        uri: 'https://compactx.xyz',
        statement: 'Sign in to CompactX',
        version: '1',
        chainId: mockChainId,
        nonce: '123456',
        issuedAt: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 3600000).toISOString(),
      };

      // Mock the API response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to create session' }),
      });

      await expect(
        client.createSession({
          signature: mockSignature,
          payload: mockPayload,
        })
      ).rejects.toThrow('Failed to create session');
    });
  });

  describe('Session Verification', () => {
    it('should verify session successfully', async () => {
      // Set up a mock session ID
      localStorage.setItem('sessionId', 'mock-session-id');
      client = new SmallocatorClient(); // Reinitialize to pick up the session ID

      // Mock the API response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session: {
            id: 'mock-session-id',
            address: mockAddress,
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          },
        }),
      });

      const response = await client.verifySession();

      expect(response).toEqual({
        valid: true,
        session: {
          id: 'mock-session-id',
          address: mockAddress,
          expiresAt: expect.any(String),
        },
      });
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/session',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-session-id': 'mock-session-id',
          }),
        })
      );
    });

    it('should handle invalid session', async () => {
      client.setTestSessionId('invalid-session-id');

      // Mock both the GET and subsequent DELETE requests
      global.fetch = vi
        .fn()
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({ error: 'Invalid session' }),
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({}),
          })
        );

      const response = await client.verifySession();
      expect(response).toEqual({ valid: false, error: 'Invalid session' });
      expect(localStorage.getItem('sessionId')).toBeNull();
    });

    it('should return invalid for missing session', async () => {
      client.setTestSessionId(null);
      const response = await client.verifySession();
      expect(response).toEqual({ valid: false, error: 'No session found' });
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Session Deletion', () => {
    it('should delete session successfully', async () => {
      // Set up a mock session ID
      localStorage.setItem('sessionId', 'mock-session-id');
      client = new SmallocatorClient(); // Reinitialize to pick up the session ID

      // Mock the API response - DELETE can return empty response
      global.fetch = vi.fn().mockImplementation((url: string, options?: { method: string }) => {
        if (url.endsWith('/session')) {
          if (options?.method === 'DELETE') {
            return Promise.resolve({
              ok: true,
              status: 200,
              // Some servers might not return content for DELETE
              json: async () => {
                throw new Error('No content');
              },
            });
          }
        }
        return Promise.reject(new Error('Not found'));
      });

      await client.clearSession();

      expect(localStorage.getItem('sessionId')).toBeNull();
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/session',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-session-id': 'mock-session-id',
          }),
        })
      );
    });

    it('should handle session deletion failure with error response', async () => {
      // Set up a mock session ID
      localStorage.setItem('sessionId', 'mock-session-id');
      client = new SmallocatorClient(); // Reinitialize to pick up the session ID

      // Mock the API response with error
      global.fetch = vi.fn().mockImplementation((url: string, options?: { method: string }) => {
        if (url.endsWith('/session')) {
          if (options?.method === 'DELETE') {
            return Promise.resolve({
              ok: false,
              status: 500,
              json: async () => ({ error: 'Failed to delete session. Please try again later.' }),
            });
          }
        }
        return Promise.reject(new Error('Not found'));
      });

      await expect(client.clearSession()).rejects.toThrow(
        'Failed to delete session. Please try again later.'
      );

      // Session should NOT be cleared if deletion failed
      expect(localStorage.getItem('sessionId')).toBe('mock-session-id');
    });

    it('should handle session deletion with network error', async () => {
      // Set up a mock session ID
      localStorage.setItem('sessionId', 'mock-session-id');
      client = new SmallocatorClient(); // Reinitialize to pick up the session ID

      // Mock a network error
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.reject(new Error('Network error'));
      });

      await expect(client.clearSession()).rejects.toThrow('Network error');

      // Session should NOT be cleared if network request fails
      expect(localStorage.getItem('sessionId')).toBe('mock-session-id');
    });

    it('should handle sign out when DELETE request fails', async () => {
      // Set up initial authenticated state
      localStorage.setItem('sessionId', 'test-session');
      client = new SmallocatorClient(); // Reinitialize to pick up the session ID

      // Mock the API responses
      global.fetch = vi.fn().mockImplementation((_url: string, options?: { method: string }) => {
        // Handle GET request for session verification
        if (options?.method === 'GET') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              valid: true,
              session: {
                id: 'test-session',
                address: '0x1234567890123456789012345678901234567890',
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
              },
            }),
          });
        }
        // Handle DELETE request for session deletion
        if (options?.method === 'DELETE') {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: async () => ({
              error: 'Failed to delete session. Please try again later.',
            }),
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      // Attempt to sign out - should throw error
      await expect(client.clearSession()).rejects.toThrow(
        'Failed to delete session. Please try again later.'
      );

      // Verify state is NOT cleared when deletion fails
      expect(localStorage.getItem('sessionId')).toBe('test-session');
    });
  });
});
