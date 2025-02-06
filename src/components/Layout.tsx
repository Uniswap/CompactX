import { PropsWithChildren } from 'react';
import { ConnectButton } from '../config/wallet';
import { useAuth } from '../hooks/useAuth';
import { useAccount } from 'wagmi';
import { Spin } from 'antd';

export const Layout = ({ children }: PropsWithChildren) => {
  const { isConnected } = useAccount();
  const { isAuthenticated, isLoading, signIn, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="p-4 border-b border-gray-800">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">CompactX</h1>
          <div className="flex items-center">
            <div className="iekbcc0 ju367va ju367v1s">
              <ConnectButton />
              {isConnected && !isLoading && (
                <button
                  onClick={isAuthenticated ? signOut : signIn}
                  className="iekbcc0 iekbcc9 ju367v76 ju367v7r ju367v8b ju367v6k ju367v4 ju367va3 ju367vn ju367vei ju367vfu ju367vb ju367va ju367v16 ju367v1h ju367v1p ju367v8u _12cbo8i3 ju367v8r _12cbo8i4 _12cbo8i6"
                  style={{
                    backgroundColor: 'rgb(26, 27, 31)',
                    borderRadius: '12px',
                    marginLeft: '-1px',
                  }}
                >
                  <div className="iekbcc0 ju367v8b ju367v6k ju367v77 ju367v7q ju367v9 ju367v6">
                    🤏 {isAuthenticated ? 'Sign out of' : 'Sign in to'} Smallocator
                  </div>
                </button>
              )}
              {isLoading && <Spin size="small" />}
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4">{children}</main>
    </div>
  );
};
