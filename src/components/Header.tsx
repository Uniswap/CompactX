import { useHealthCheck } from '../hooks/useHealthCheck';

export function Header() {
  const { isHealthy, lastChecked } = useHealthCheck();

  return (
    <div className="w-full bg-[#0a0a0a] border-b border-gray-800 p-4">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-xl font-bold text-[#00ff00]">CompactX</h1>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isHealthy ? 'bg-[#00ff00]' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-400">
            {isHealthy ? 'System Healthy' : 'System Unhealthy'}
          </span>
          {lastChecked && (
            <span className="text-xs text-gray-500">
              Last checked: {lastChecked.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
