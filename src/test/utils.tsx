import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiConfig, createConfig, mainnet } from 'wagmi'
import { createPublicClient, http } from 'viem'
import { PropsWithChildren } from 'react'

const config = createConfig({
  autoConnect: true,
  publicClient: createPublicClient({
    chain: mainnet,
    transport: http(),
  }),
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

export function createWrapper() {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <WagmiConfig config={config}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </WagmiConfig>
    )
  }
}
