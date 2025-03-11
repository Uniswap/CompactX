import { useState, useEffect } from 'react';
import { useAllocator } from './useAllocator';
import { ALLOCATORS } from '../config/constants';

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
  const { selectedAllocator } = useAllocator();

  useEffect(() => {
    // Function to perform health check
    const checkHealth = async () => {
      try {
        // Use the appropriate allocator URL based on the selected allocator
        const allocatorUrl = ALLOCATORS[selectedAllocator].url;
        const response = await fetch(`${allocatorUrl}/health`);
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
  }, [selectedAllocator]);

  return {
    isHealthy,
    chainInfo,
    lastChecked,
  };
}
