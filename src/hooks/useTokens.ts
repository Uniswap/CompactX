import { useChainId } from 'wagmi';
import { INITIAL_CONFIG } from '../config/constants';
import { Token } from '../types';
import { useCustomTokens } from './useCustomTokens';

export function useTokens(): { inputTokens: Token[]; outputTokens: Token[] } {
  const chainId = useChainId();
  const { getCustomTokens } = useCustomTokens();

  // Get default tokens for the current chain
  const defaultTokens = INITIAL_CONFIG.tokens.filter(token => token.chainId === chainId) as Token[];

  // Get custom tokens for the current chain
  const customTokens = getCustomTokens(chainId);

  // Combine default and custom tokens
  const inputTokens = [...defaultTokens, ...customTokens];

  // Get tokens from other supported chains for output token selection
  const outputTokens = INITIAL_CONFIG.tokens.filter(token => token.chainId !== chainId) as Token[];

  return { inputTokens, outputTokens };
}
