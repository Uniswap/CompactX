import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

export interface CustomToken {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

const CUSTOM_TOKENS_KEY = 'compactx_custom_tokens';

export function useCustomTokens() {
  const { address } = useAccount();
  const [customTokens, setCustomTokens] = useState<Record<number, CustomToken[]>>({});

  // Load custom tokens from localStorage on mount
  useEffect(() => {
    if (!address) return;

    const storedTokens = localStorage.getItem(`${CUSTOM_TOKENS_KEY}_${address}`);
    if (storedTokens) {
      try {
        setCustomTokens(JSON.parse(storedTokens));
      } catch (e) {
        console.error('Failed to parse custom tokens:', e);
      }
    }
  }, [address]);

  // Save custom tokens to localStorage whenever they change
  useEffect(() => {
    if (!address || Object.keys(customTokens).length === 0) return;

    localStorage.setItem(`${CUSTOM_TOKENS_KEY}_${address}`, JSON.stringify(customTokens));
  }, [customTokens, address]);

  const addCustomToken = (token: CustomToken) => {
    setCustomTokens(prev => {
      const chainTokens = prev[token.chainId] || [];
      // Check if token already exists
      const exists = chainTokens.some(t => t.address === token.address);
      if (exists) return prev;

      return {
        ...prev,
        [token.chainId]: [...chainTokens, token],
      };
    });
  };

  const removeCustomToken = (chainId: number, address: string) => {
    setCustomTokens(prev => {
      const chainTokens = prev[chainId] || [];
      return {
        ...prev,
        [chainId]: chainTokens.filter(t => t.address !== address),
      };
    });
  };

  const getCustomTokens = (chainId: number) => {
    return customTokens[chainId] || [];
  };

  return {
    customTokens,
    addCustomToken,
    removeCustomToken,
    getCustomTokens,
  };
}
