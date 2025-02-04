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
        json: async () => ({ valid: true }),
      });

      const response = await client.verifySession();

      expect(response).toEqual({ valid: true });
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/session/verify',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'x-session-id': 'mock-session-id',
          }),
        })
      );
    });

    it('should handle invalid session', async () => {
      client.setTestSessionId('invalid-session-id');
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid session' }),
      });

      const response = await client.verifySession();
      expect(response).toEqual({ valid: false });
    });

    it('should return invalid for missing session', async () => {
      client.setTestSessionId(null);
      const response = await client.verifySession();
      expect(response).toEqual({ valid: false });
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
