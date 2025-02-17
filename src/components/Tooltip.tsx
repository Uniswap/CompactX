import { useState, useRef, useEffect } from 'react';

export interface TooltipProps {
  title: string;
  children: React.ReactNode;
}

export function Tooltip({ title, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={tooltipRef}>
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="inline-flex items-center cursor-help"
      >
        {children}
      </div>
      {isVisible && (
        <div
          style={{
            maxWidth: '960px',
            width: '400px',
            left: '-200px',
          }}
          className="absolute z-50 bottom-full mb-2 px-3 py-2 text-sm bg-gray-900 text-white rounded shadow-lg whitespace-normal"
        >
          {title}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900" />
        </div>
      )}
    </div>
  );
}
