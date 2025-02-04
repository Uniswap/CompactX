import { PropsWithChildren } from 'react';
import { ConnectButton } from '../config/wallet';
import { useAuth } from '../hooks/useAuth';
import { useAccount } from 'wagmi';
import { Button, Spin } from 'antd';

export const Layout = ({ children }: PropsWithChildren) => {
  const { isConnected } = useAccount();
  const { isAuthenticated, isLoading, signIn, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="p-4 border-b border-gray-800">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">CompactX</h1>
          <div className="flex items-center gap-4">
            {isConnected && (
              <>
                {isLoading ? (
                  <Spin size="small" />
                ) : isAuthenticated ? (
                  <Button
                    onClick={() => {
                      signOut().catch(console.error);
                    }}
                    type="link"
                    danger
                  >
                    Sign Out
                  </Button>
                ) : (
                  <Button onClick={signIn} type="link">
                    Sign In
                  </Button>
                )}
              </>
            )}
            <ConnectButton />
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4">{children}</main>
    </div>
  );
};
