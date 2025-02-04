import { useChainId as wagmiUseChainId } from 'wagmi';

export function useChainId() {
  return wagmiUseChainId();
}
