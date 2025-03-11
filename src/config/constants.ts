import type { Token } from '../types/index';

export const ALLOCATORS = {
  AUTOCATOR: {
    id: '1730150456036417775412616585',
    signingAddress: '0x4491fB95F2d51416688D4862f0cAeFE5281Fa3d9', // used to verify signatures from server
    url: 'https://autocator.org',
  },
  SMALLOCATOR: {
    id: '1223867955028248789127899354',
    signingAddress: '0x51044301738Ba2a27bd9332510565eBE9F03546b',
    url: 'https://smallocator.xyz',
  },
} as const;

export const INITIAL_CONFIG = {
  supportedChains: [1, 130, 8453, 10], // Mainnet, Unichain, Base, & Optimism
  tokens: [
    // Native ETH for each chain
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
      chainId: 1,
    },
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
      chainId: 10,
    },
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
      chainId: 8453,
    },
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
      chainId: 130,
    },
    // Mainnet tokens
    {
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      chainId: 1,
    },
    {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: 1,
    },
    // Optimism tokens
    {
      address: '0x4200000000000000000000000000000000000006',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      chainId: 10,
    },
    {
      address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: 10,
    },
    // Base tokens
    {
      address: '0x4200000000000000000000000000000000000006',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      chainId: 8453,
    },
    {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: 8453,
    },
    // Unichain tokens
    {
      address: '0x4200000000000000000000000000000000000006',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      chainId: 130,
    },
    {
      address: '0x078d782b760474a361dda0af3839290b0ef57ad6',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: 130,
    },
  ] satisfies Token[],
  defaultSlippage: 100, // 1%
  quoteRefreshInterval: 5000, // 5 seconds
  sessionRefreshThreshold: 600000, // 10 minutes
} as const;
