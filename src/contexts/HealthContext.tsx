import { createContext, useContext, PropsWithChildren } from 'react';
import { useHealthCheck } from '../hooks/useHealthCheck';

interface ChainInfo {
  chainId: string;
  allocatorId: string;
  finalizationThresholdSeconds: number;
}

interface HealthContextType {
  isHealthy: boolean;
  chainInfo: Map<string, ChainInfo>;
  lastChecked?: Date;
}

const HealthContext = createContext<HealthContextType>({
  isHealthy: true,
  chainInfo: new Map(),
});

export function HealthProvider({ children }: PropsWithChildren) {
  const healthCheck = useHealthCheck();

  return <HealthContext.Provider value={healthCheck}>{children}</HealthContext.Provider>;
}

export function useHealth() {
  return useContext(HealthContext);
}
