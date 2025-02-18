import { PropsWithChildren } from 'react';
import { useHealthCheck } from '../hooks/useHealthCheck';
import { HealthContext } from './HealthContext';

export function HealthProvider({ children }: PropsWithChildren) {
  const healthCheck = useHealthCheck();

  return <HealthContext.Provider value={healthCheck}>{children}</HealthContext.Provider>;
}
