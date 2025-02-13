import { PropsWithChildren } from 'react';
import { ConnectButton } from '../config/wallet';
import { useAuth } from '../hooks/useAuth';
import { useAccount } from 'wagmi';

export const Layout = ({ children }: PropsWithChildren) => {
  const { isConnected } = useAccount();
  const { isAuthenticated, isLoading, signIn, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <header className="bg-[#0a0a0a] border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold flex items-center gap-4">
              <span className="flex relative">
                <span className="text-[#00ff00]">Com</span>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00ff00] to-[#ff007a]">pac</span>
                <span className="text-[#ff007a]">tX</span>
              </span>
              <span>🤝</span>
            </h1>
            <div className="flex items-center gap-4">
              <ConnectButton />
              {isConnected && !isLoading && (
                <button
                  onClick={isAuthenticated ? signOut : signIn}
                  className="inline-flex items-center px-3 py-2.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors"
                >
                  <span className="flex items-center">
                    🤏 {isAuthenticated ? 'Sign out of' : 'Sign in to'} Smallocator
                  </span>
                </button>
              )}
              {isLoading && (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#00ff00] border-t-transparent" />
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">{children}</main>
    </div>
  );
};
