import { useCallback, useEffect, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { SmallocatorClient, SessionPayload } from '../api/smallocator';

const client = new SmallocatorClient();

export function useAuth() {
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Check if we have a valid session on mount
  useEffect(() => {
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
      // Verify session with backend
      client
        .verifySession()
        .then(() => setIsAuthenticated(true))
        .catch(() => {
          // If session is invalid, clear it
          localStorage.removeItem('sessionId');
          setIsAuthenticated(false);
        });
    }
  }, []);

  // Sign in with wallet
  const signIn = useCallback(async () => {
    if (!address || !chainId) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get session payload
      const { payload } = await client.getSessionPayload(chainId, address);

      // Format and sign the message
      const message = formatMessage(payload);
      const signature = await signMessageAsync({ message });

      // Create session
      const response = await client.createSession({
        signature,
        payload,
      });

      setIsAuthenticated(true);
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to sign in');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [address, chainId, signMessageAsync]);

  // Sign out
  const signOut = useCallback(() => {
    localStorage.removeItem('sessionId');
    setIsAuthenticated(false);
  }, []);

  return {
    isAuthenticated,
    isLoading,
    error,
    signIn,
    signOut,
  };
}

// Format the message according to smallocator's format
function formatMessage(payload: SessionPayload): string {
  return `${payload.domain} wants you to sign in with your Ethereum account:
${payload.address}

${payload.statement}

URI: ${payload.uri}
Version: ${payload.version}
Chain ID: ${payload.chainId}
Nonce: ${payload.nonce}
Issued At: ${payload.issuedAt}
Expiration Time: ${payload.expirationTime}`;
}
