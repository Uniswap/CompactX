import { createContext } from 'react';
import type { HealthContextType } from './healthTypes';

export const HealthContext = createContext<HealthContextType>({
  isHealthy: true,
  chainInfo: new Map(),
});
