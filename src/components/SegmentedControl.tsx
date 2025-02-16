import React from 'react';

interface SegmentedControlProps {
  options: { label: string; value: any }[];
  value: any;
  onChange: (value: any) => void;
  'aria-label'?: string;
  columns?: number;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  columns = 1,
}: SegmentedControlProps) {
  const isGrid = columns > 1;
  
  return (
    <div 
      className={`
        inline-grid
        ${isGrid ? `grid-cols-3` : 'grid-cols-2'}
        gap-1 p-1 rounded-lg border border-gray-800 bg-[#0a0a0a] w-full
      `}
      role="radiogroup" 
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <div
            key={option.label}
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option.value)}
            className={`
              px-3 py-1.5 text-[0.75rem] rounded-md whitespace-nowrap cursor-pointer
              flex items-center justify-center
              ${isSelected
                ? 'bg-[#00ff00]/10 text-[#00ff00] border border-[#00ff00]/30'
                : 'bg-[#111111] text-gray-500 hover:text-gray-400 border border-gray-800'
              }
            `}
          >
            {option.label}
          </div>
        );
      })}
    </div>
  );
}
