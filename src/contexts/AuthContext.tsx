import { useCallback, useEffect, useState, PropsWithChildren } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { smallocator } from '../api/smallocator';
import { formatMessage } from '../utils/auth';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: PropsWithChildren<unknown>) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { address: walletAddress, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  // Check if we have a valid session on mount and when wallet address changes
  useEffect(() => {
    const verifyExistingSession = async () => {
      if (!walletAddress) {
        setIsAuthenticated(false);
        setAddress(null);
        return;
      }

      try {
        const { valid, error, session } = await smallocator.verifySession(walletAddress);

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
  }, [walletAddress]); // Re-verify when wallet address changes

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

      // Store session ID in localStorage
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
  const signOut = async () => {
    try {
      if (address) {
        await smallocator.clearSession(address);
      }
      // Clear session ID from localStorage
      localStorage.removeItem('sessionId');
      setIsAuthenticated(false);
      setAddress(null);
      setError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sign out';
      console.error('Error during sign out:', message);
      setError(message);
      // Still clear local state even if server deletion fails
      localStorage.removeItem('sessionId');
      setIsAuthenticated(false);
      setAddress(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        error,
        address,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
