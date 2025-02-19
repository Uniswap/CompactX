interface ToggleGroupProps<T> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  'aria-label'?: string;
}

export function ToggleGroup<T extends string | number>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
}: ToggleGroupProps<T>) {
  return (
    <div className="flex gap-2" role="radiogroup" aria-label={ariaLabel}>
      {options.map(option => (
        <button
          key={option.label}
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`
            px-4 py-2 rounded-lg border transition-colors
            ${
              value === option.value
                ? 'bg-[#00ff00]/10 border-[#00ff00]/50 text-[#00ff00]'
                : 'bg-transparent border-gray-800 text-gray-400 hover:border-gray-700'
            }
          `}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
