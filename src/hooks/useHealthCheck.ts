import { useState, useEffect } from 'react';

interface ChainInfo {
  chainId: string;
  allocatorId: string;
  finalizationThresholdSeconds: number;
}

interface HealthCheckResponse {
  status: string;
  allocatorAddress: string;
  signingAddress: string;
  timestamp: string;
  supportedChains: ChainInfo[];
}

export function useHealthCheck() {
  const [isHealthy, setIsHealthy] = useState(true);
  const [chainInfo, setChainInfo] = useState<Map<string, ChainInfo>>(new Map());
  const [lastChecked, setLastChecked] = useState<Date>();

  useEffect(() => {
    // Function to perform health check
    const checkHealth = async () => {
      try {
        const response = await fetch('https://smallocator.xyz/health');
        const data: HealthCheckResponse = await response.json();

        // Update health status
        setIsHealthy(data.status === 'healthy');
        setLastChecked(new Date());

        // Update chain info map
        const newChainInfo = new Map<string, ChainInfo>();
        data.supportedChains.forEach(chain => {
          newChainInfo.set(chain.chainId, chain);
        });
        setChainInfo(newChainInfo);
      } catch (error) {
        console.error('Health check failed:', error);
        setIsHealthy(false);
      }
    };

    // Perform initial check
    checkHealth();

    // Set up interval for periodic checks
    const interval = setInterval(checkHealth, 60000); // Check every minute

    // Clean up interval on unmount
    return () => clearInterval(interval);
  }, []);

  return {
    isHealthy,
    chainInfo,
    lastChecked,
  };
}
