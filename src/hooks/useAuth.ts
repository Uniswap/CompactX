import { useCallback, useEffect, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { smallocator, type SessionPayload } from '../api/smallocator';

// Format the message according to EIP-4361
function formatMessage(session: SessionPayload): string {
  return [
    `${session.domain} wants you to sign in with your Ethereum account:`,
    session.address,
    '',
    session.statement,
    '',
    `URI: ${session.uri}`,
    `Version: ${session.version}`,
    `Chain ID: ${session.chainId}`,
    `Nonce: ${session.nonce}`,
    `Issued At: ${session.issuedAt}`,
    `Expiration Time: ${session.expirationTime}`,
  ].join('\n');
}

export function useAuth() {
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Check if we have a valid session on mount
  useEffect(() => {
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
      setIsAuthenticated(false);
      return;
    }

    // Verify session with backend
    smallocator
      .verifySession()
      .then(() => setIsAuthenticated(true))
      .catch(() => {
        // If session is invalid, clear it
        localStorage.removeItem('sessionId');
        setIsAuthenticated(false);
      });
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
      const { session } = await smallocator.getSessionPayload(chainId, address);

      // Format and sign the message
      const message = formatMessage(session);
      const signature = await signMessageAsync({ message });

      // Create session
      const response = await smallocator.createSession({
        signature,
        payload: {
          ...session,
          chainId: parseInt(session.chainId.toString(), 10),
        },
      });

      // Store the session ID
      localStorage.setItem('sessionId', response.sessionId);
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
