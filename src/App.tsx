import { WagmiConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config, RainbowKitProvider, darkTheme } from './config/wallet';
import { Layout } from './components/Layout';
import { TradeForm } from './components/TradeForm';
import { AuthProvider } from './contexts/AuthContext';
import { HealthProvider } from './contexts/HealthContext.tsx';
import { AllocatorProvider } from './contexts/AllocatorContext';

// Create a client for React Query
const queryClient = new QueryClient();

function AppContent() {
  return (
    <Layout>
      <div className="w-full max-w-2xl mx-auto">
        <TradeForm />
      </div>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={config}>
        <RainbowKitProvider modalSize="compact" theme={darkTheme()}>
          <AuthProvider>
            <AllocatorProvider>
              <HealthProvider>
                <AppContent />
              </HealthProvider>
            </AllocatorProvider>
          </AuthProvider>
        </RainbowKitProvider>
      </WagmiConfig>
    </QueryClientProvider>
  );
}

export default App;
