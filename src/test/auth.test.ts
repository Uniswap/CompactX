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
        json: async () => ({ payload: mockPayload }),
      });

      const response = await client.getSessionPayload(mockChainId, mockAddress);

      expect(response.payload).toEqual(mockPayload);
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

    it('should handle session payload fetch errors', async () => {
      // Mock a failed API response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid address' }),
      });

      await expect(client.getSessionPayload(mockChainId, mockAddress)).rejects.toThrow(
        'Invalid address'
      );
    });
  });

  describe('Session Creation', () => {
    it('should create session successfully', async () => {
      const mockSessionId = 'session123';
      const mockSignature = '0xabcdef...';
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
        json: async () => ({ sessionId: mockSessionId }),
      });

      const response = await client.createSession({
        signature: mockSignature,
        payload: mockPayload,
      });

      expect(response.sessionId).toBe(mockSessionId);
      expect(localStorage.getItem('sessionId')).toBe(mockSessionId);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/session',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            signature: mockSignature,
            payload: mockPayload,
          }),
        })
      );
    });

    it('should handle session creation errors', async () => {
      // Mock a failed API response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid signature' }),
      });

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

      await expect(
        client.createSession({
          signature: 'invalid-signature',
          payload: mockPayload,
        })
      ).rejects.toThrow('Invalid signature');
    });
  });

  describe('Session Verification', () => {
    it('should verify existing session', async () => {
      // Set session ID before creating client
      localStorage.setItem('sessionId', 'valid-session');
      client = new SmallocatorClient(); // Reinitialize to pick up session ID

      // Mock successful verification
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
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': 'valid-session',
          },
        })
      );
    });

    it('should handle invalid session', async () => {
      // Set session ID before creating client
      localStorage.setItem('sessionId', 'invalid-session');
      client = new SmallocatorClient(); // Reinitialize to pick up session ID

      // Mock failed verification
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid session' }),
      });

      await expect(client.verifySession()).rejects.toThrow('Invalid session');
    });
  });
});
