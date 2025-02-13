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
  const formatValue = (val: string): string => {
    if (!val) return '';
    // Special case: if the input is just "0", preserve it
    if (val === '0') return '0';
    // Remove non-numeric characters except decimal point
    const numericValue = val.replace(/[^\d.]/g, '');
    // Ensure only one decimal point
    const parts = numericValue.split('.');
    const formattedValue = parts[0] + (parts.length > 1 ? '.' + parts[1] : '');
    // Remove trailing zeros after decimal point unless it's just typing
    if (!val.endsWith('.') && !val.endsWith('0')) {
      return formattedValue.replace(/\.?0+$/, '');
    }
    return formattedValue;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatValue(e.target.value);
    
    // Handle min/max constraints
    if (min !== undefined && Number(formatted) < min) return;
    if (max !== undefined && Number(formatted) > max) return;
    
    // Handle precision
    const parts = formatted.split('.');
    if (parts.length > 1 && parts[1].length > precision) return;
    
    onChange(formatted);
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
