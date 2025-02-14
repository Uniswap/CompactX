export interface NumberInputProps {
  value?: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  precision?: number;
  variant?: 'default' | 'borderless';
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
}

export function NumberInput({
  value,
  onChange,
  placeholder = '0.0',
  min,
  max,
  precision = 18,
  variant = 'default',
  className = '',
  style,
  'aria-label': ariaLabel,
}: NumberInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    
    // Allow empty input
    if (!val) {
      onChange('');
      return;
    }

    // Only allow numbers and a single decimal point
    if (!/^[0-9]*\.?[0-9]*$/.test(val)) {
      return;
    }

    // Don't allow more than one decimal point
    if ((val.match(/\./g) || []).length > 1) {
      return;
    }

    // Handle precision limit only if we have decimals
    if (val.includes('.')) {
      const decimals = val.split('.')[1];
      if (decimals && decimals.length > precision) {
        return;
      }
    }

    // Handle min/max only for complete numbers (not during typing)
    if (val !== '.' && val !== '') {
      const num = Number(val);
      if (min !== undefined && num < min) return;
      if (max !== undefined && num > max) return;
    }

    onChange(val);
  };

  const baseClasses = "w-full px-3 py-2 bg-[#1a1a1a] text-white focus:outline-none focus:ring-2 focus:ring-[#00ff00]/50";
  const variantClasses = variant === 'borderless' 
    ? "border-0" 
    : "border border-gray-700 rounded-lg";

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className={`${baseClasses} ${variantClasses} ${className}`}
      style={style}
      aria-label={ariaLabel}
    />
  );
}
