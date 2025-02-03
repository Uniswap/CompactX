import { WagmiConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config, RainbowKitProvider, darkTheme } from './config/wallet';
import { Layout } from './components/Layout';

// Create a client for React Query
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={config}>
        <RainbowKitProvider modalSize="compact" theme={darkTheme()}>
          <Layout>
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
              <h2 className="text-2xl font-bold mb-4">Welcome to CompactX</h2>
              <p className="text-gray-400">Connect your wallet to get started</p>
            </div>
          </Layout>
        </RainbowKitProvider>
      </WagmiConfig>
    </QueryClientProvider>
  );
}

export default App;
