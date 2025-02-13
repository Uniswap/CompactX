import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmallocatorClient } from '../api/smallocator';
import { SessionPayload } from '../api/smallocator';

// Mock the environment variables
vi.stubEnv('VITE_SMALLOCATOR_URL', 'http://localhost:3000');

describe('Authentication Flow', () => {
  let client: SmallocatorClient;
  const mockAddress = '0x1234567890123456789012345678901234567890';
  const mockAddress2 = '0x2234567890123456789012345678901234567890';
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
      const sessions = JSON.parse(localStorage.getItem('smallocator_sessions') || '{}');
      expect(sessions[mockAddress.toLowerCase()]).toBe('mock-session-id');
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
    it('should verify session successfully for specific address', async () => {
      // Set up a mock session
      const sessions = { [mockAddress.toLowerCase()]: 'mock-session-id' };
      localStorage.setItem('smallocator_sessions', JSON.stringify(sessions));

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

      const response = await client.verifySession(mockAddress);

      expect(response).toEqual({
        valid: true,
        session: {
          id: 'mock-session-id',
          address: mockAddress,
          expiresAt: expect.any(String),
        },
      });
    });

    it('should handle session verification for wrong address', async () => {
      // Set up a mock session for one address
      const sessions = { [mockAddress.toLowerCase()]: 'mock-session-id' };
      localStorage.setItem('smallocator_sessions', JSON.stringify(sessions));

      // Mock API response with different address
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session: {
            id: 'mock-session-id',
            address: mockAddress2, // Different address
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          },
        }),
      });

      const response = await client.verifySession(mockAddress);
      expect(response.valid).toBe(false);
      expect(response.error).toBe('Session address mismatch');
    });

    it('should handle multiple account sessions', async () => {
      // Set up mock sessions for two addresses
      const sessions = {
        [mockAddress.toLowerCase()]: 'mock-session-id-1',
        [mockAddress2.toLowerCase()]: 'mock-session-id-2',
      };
      localStorage.setItem('smallocator_sessions', JSON.stringify(sessions));

      // Mock API responses for both sessions
      global.fetch = vi
        .fn()
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: async () => ({
              session: {
                id: 'mock-session-id-1',
                address: mockAddress,
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
              },
            }),
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: async () => ({
              session: {
                id: 'mock-session-id-2',
                address: mockAddress2,
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
              },
            }),
          })
        );

      // Verify first session
      const response1 = await client.verifySession(mockAddress);
      expect(response1.valid).toBe(true);
      expect(response1.session?.address).toBe(mockAddress);

      // Verify second session
      const response2 = await client.verifySession(mockAddress2);
      expect(response2.valid).toBe(true);
      expect(response2.session?.address).toBe(mockAddress2);
    });

    it('should handle invalid session', async () => {
      const sessions = { [mockAddress.toLowerCase()]: 'invalid-session-id' };
      localStorage.setItem('smallocator_sessions', JSON.stringify(sessions));

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

      const response = await client.verifySession(mockAddress);
      expect(response).toEqual({ valid: false, error: 'Invalid session' });
      
      const updatedSessions = JSON.parse(localStorage.getItem('smallocator_sessions') || '{}');
      expect(updatedSessions[mockAddress.toLowerCase()]).toBeUndefined();
    });
  });

  describe('Session Deletion', () => {
    it('should delete specific address session successfully', async () => {
      // Set up mock sessions for two addresses
      const sessions = {
        [mockAddress.toLowerCase()]: 'mock-session-id-1',
        [mockAddress2.toLowerCase()]: 'mock-session-id-2',
      };
      localStorage.setItem('smallocator_sessions', JSON.stringify(sessions));

      // Mock the API response
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
      );

      await client.clearSession(mockAddress);

      const remainingSessions = JSON.parse(localStorage.getItem('smallocator_sessions') || '{}');
      expect(remainingSessions[mockAddress.toLowerCase()]).toBeUndefined();
      expect(remainingSessions[mockAddress2.toLowerCase()]).toBe('mock-session-id-2');
    });

    it('should delete all sessions when no address specified', async () => {
      // Set up mock sessions for multiple addresses
      const sessions = {
        [mockAddress.toLowerCase()]: 'mock-session-id-1',
        [mockAddress2.toLowerCase()]: 'mock-session-id-2',
      };
      localStorage.setItem('smallocator_sessions', JSON.stringify(sessions));

      // Mock the API response
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
      );

      await client.clearSession();

      expect(localStorage.getItem('smallocator_sessions')).toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(2); // Once for each session
    });

    it('should handle session deletion failure', async () => {
      // Set up mock sessions
      const sessions = { [mockAddress.toLowerCase()]: 'mock-session-id' };
      localStorage.setItem('smallocator_sessions', JSON.stringify(sessions));

      // Mock the API response with error
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Failed to delete session' }),
        })
      );

      await expect(client.clearSession(mockAddress)).rejects.toThrow('Failed to delete session');

      // Session should still exist
      const remainingSessions = JSON.parse(localStorage.getItem('smallocator_sessions') || '{}');
      expect(remainingSessions[mockAddress.toLowerCase()]).toBe('mock-session-id');
    });
  });
});
