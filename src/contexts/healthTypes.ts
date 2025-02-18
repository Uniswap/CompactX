export interface ChainInfo {
  chainId: string;
  allocatorId: string;
  finalizationThresholdSeconds: number;
}

export interface HealthContextType {
  isHealthy: boolean;
  chainInfo: Map<string, ChainInfo>;
  lastChecked?: Date;
}
