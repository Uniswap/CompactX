import { Tooltip } from './Tooltip';

interface TooltipIconProps {
  title: string;
  width?: number;
  offset?: number;
}

export function TooltipIcon({ title, width, offset }: TooltipIconProps) {
  return (
    <Tooltip title={title} width={width} offset={offset}>
      <div className="w-4 h-4 rounded-full bg-gray-800 flex items-center justify-center text-xs text-gray-400 cursor-help">
        ?
      </div>
    </Tooltip>
  );
}
