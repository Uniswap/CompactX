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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { address: walletAddress, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  // Check if we have a valid session on mount
  useEffect(() => {
    const verifyExistingSession = async () => {
      const sessionId = localStorage.getItem('sessionId');
      if (!sessionId) {
        setIsAuthenticated(false);
        setAddress(null);
        return;
      }

      try {
        const { valid, error, session } = await smallocator.verifySession();

        if (!valid || !session) {
          setError(error || 'Session verification failed');
          setIsAuthenticated(false);
          setAddress(null);
          return;
        }

        setIsAuthenticated(true);
        setAddress(session.address);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Session verification failed');
        setIsAuthenticated(false);
        setAddress(null);
      }
    };

    verifyExistingSession();
  }, []);

  // Sign in with wallet
  const signIn = useCallback(async () => {
    if (!walletAddress || !isConnected) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get session payload for Optimism
      const chainId = 10;
      const response = await smallocator.getSessionPayload(chainId, walletAddress);

      // The server already provides the correctly formatted payload
      const { session } = response;

      // Sign the message
      const message = formatMessage(session);
      const signature = await signMessageAsync({ message });

      // Create session with signed payload
      const { sessionId } = await smallocator.createSession({
        signature,
        payload: session,
      });

      // Store session ID
      localStorage.setItem('sessionId', sessionId);
      setIsAuthenticated(true);
      setAddress(walletAddress);
    } catch (err) {
      console.error('Sign in error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      setIsAuthenticated(false);
      setAddress(null);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, isConnected, signMessageAsync]);

  // Sign out
  const signOut = useCallback(() => {
    localStorage.removeItem('sessionId');
    setIsAuthenticated(false);
    setAddress(null);
    setError(null);
  }, []);

  return {
    isAuthenticated,
    isLoading,
    error,
    address,
    signIn,
    signOut,
  };
}
