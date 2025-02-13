import { useChainId, useAccount } from 'wagmi';
import { INITIAL_CONFIG } from '../config/constants';
import { Token } from '../types';
import { useCustomTokens } from './useCustomTokens';

export function useTokens(selectedInputChain?: number): {
  inputTokens: Token[];
  outputTokens: Token[];
} {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { getCustomTokens } = useCustomTokens();

  // Determine which chain to use for input tokens
  const effectiveChainId = isConnected ? chainId : (selectedInputChain ?? 1); // Default to Ethereum (1)

  // Get default tokens for the effective chain
  const defaultTokens = INITIAL_CONFIG.tokens.filter(
    token => token.chainId === effectiveChainId
  ) as Token[];

  // Get custom tokens for the effective chain
  const customTokens = getCustomTokens(effectiveChainId);

  // Combine default and custom tokens
  const inputTokens = [...defaultTokens, ...customTokens];

  // Get tokens from other supported chains for output token selection
  const outputTokens = INITIAL_CONFIG.tokens.filter(
    token => token.chainId !== effectiveChainId
  ) as Token[];

  return { inputTokens, outputTokens };
}
