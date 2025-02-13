import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Allow time for fade out animation
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const baseClasses = "fixed top-4 right-4 p-4 rounded-lg shadow-lg transform transition-all duration-300";
  const typeClasses = type === 'success' 
    ? "bg-green-500 text-white" 
    : "bg-red-500 text-white";
  const visibilityClasses = isVisible 
    ? "translate-y-0 opacity-100" 
    : "translate-y-2 opacity-0";

  return (
    <div className={`${baseClasses} ${typeClasses} ${visibilityClasses}`}>
      {message}
    </div>
  );
}

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const hideToast = () => {
    setToast(null);
  };

  return {
    toast,
    showToast,
    hideToast,
  };
}
