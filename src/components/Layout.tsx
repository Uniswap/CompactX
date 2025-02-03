import { PropsWithChildren } from 'react';
import { ConnectButton } from '../config/wallet';

export const Layout = ({ children }: PropsWithChildren) => {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="p-4 border-b border-gray-800">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">CompactX</h1>
          <ConnectButton />
        </div>
      </header>
      <main className="container mx-auto p-4">{children}</main>
    </div>
  );
};
