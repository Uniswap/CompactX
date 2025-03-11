import { PropsWithChildren } from 'react';
import { ConnectButton } from '../config/wallet';
import { useAuth } from '../hooks/useAuth';
import { useAccount } from 'wagmi';
import { useHealthCheck } from '../hooks/useHealthCheck';
import { useAllocator } from '../hooks/useAllocator';

export const Layout = ({ children }: PropsWithChildren) => {
  const { isConnected } = useAccount();
  const { isAuthenticated, isLoading, signIn, signOut } = useAuth();
  const { isHealthy, lastChecked } = useHealthCheck();
  const { selectedAllocator } = useAllocator();

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <header className="bg-[#0a0a0a] border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-2 md:px-4 sm:px-6 lg:px-8 py-4 overflow-x-auto">
          <div className="flex flex-wrap justify-between items-center w-full gap-1 md:gap-4">
            <h1 className="text-2xl font-bold flex items-center">
              <span className="flex relative">
                <span className="text-[#00ff00]">Com</span>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00ff00] to-[#ff007a]">
                  pac
                </span>
                <span className="text-[#ff007a]">tX</span>
              </span>
              <span className="ml-4">🤝</span>
            </h1>
            <div className="flex flex-wrap items-center gap-1 md:gap-2 pl-0">
              {isConnected && (
                <div className="flex items-center gap-1 md:gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${isHealthy ? 'bg-[#00ff00]' : 'bg-red-500'}`}
                  />
                  {!isHealthy && (
                    <>
                      <span className="text-sm text-red-500">System Unhealthy</span>
                      {lastChecked && (
                        <span className="text-xs text-gray-500">
                          Last checked: {lastChecked.toLocaleTimeString()}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
              {isConnected && !isLoading && selectedAllocator === 'SMALLOCATOR' && (
                <button
                  onClick={isAuthenticated ? signOut : signIn}
                  className="inline-flex items-center h-[38px] px-2 md:px-3 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors md:-mr-[22px] -mr-[10px]"
                >
                  <span className="flex items-center">
                    🤏 {isAuthenticated ? 'Sign Out' : 'Sign In'}
                  </span>
                </button>
              )}
              <div className="scale-90 origin-right md:-ml-[18px] -ml-[10px]">
                <ConnectButton />
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 py-8">{children}</main>
    </div>
  );
};
