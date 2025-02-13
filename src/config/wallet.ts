import '@rainbow-me/rainbowkit/styles.css';
import { http } from 'wagmi';
import { mainnet, optimism, base, Chain } from 'wagmi/chains';
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme as createDarkTheme,
  ConnectButton,
} from '@rainbow-me/rainbowkit';

// Create custom theme with semi-transparent green accent
const customTheme = createDarkTheme({
  accentColor: 'rgba(0, 255, 0, 0.1)',
  accentColorForeground: '#00ff00',
  borderRadius: 'medium',
});

// Define Unichain
const unichain = {
  id: 130,
  name: 'Unichain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.unichain.org'] },
    public: { http: ['https://mainnet.unichain.org'] },
  },
  blockExplorers: {
    default: { name: 'Uniscan', url: 'https://uniscan.xyz' },
  },
} as const satisfies Chain;

// Get project ID from environment variable
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
if (!projectId) {
  throw new Error('VITE_WALLETCONNECT_PROJECT_ID is not defined');
}

// Configure supported chains
const chains = [mainnet, optimism, base, unichain] as const;

// Create wagmi config with RainbowKit
export const config = getDefaultConfig({
  appName: 'CompactX',
  projectId,
  chains,
  transports: {
    [mainnet.id]: http(),
    [optimism.id]: http(),
    [base.id]: http(),
    [unichain.id]: http(),
  },
});

// Export components and configuration
export { RainbowKitProvider, ConnectButton, chains };
// Export custom theme
export const darkTheme = () => customTheme;
