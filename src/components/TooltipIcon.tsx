import { Tooltip } from './Tooltip';

interface TooltipIconProps {
  title: string;
}

export function TooltipIcon({ title }: TooltipIconProps) {
  return (
    <Tooltip title={title}>
      <div className="w-4 h-4 rounded-full bg-gray-800 flex items-center justify-center text-xs text-gray-400 cursor-help">
        ?
      </div>
    </Tooltip>
  );
}
