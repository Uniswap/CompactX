import type { Option, SelectProps } from '../../components/Select';
import type { NumberInputProps } from '../../components/NumberInput';
import type { TooltipProps } from '../../components/Tooltip';
import type { ModalProps } from '../../components/Modal';

export const Select = ({ value, onChange, options, ...props }: SelectProps) => (
  <select
    data-testid="select"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    {...props}
  >
    {options.map((option: Option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

export const NumberInput = ({ value, onChange, ...props }: NumberInputProps) => (
  <input
    type="text"
    data-testid="number-input"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    {...props}
  />
);

export const Tooltip = ({ title, children }: TooltipProps) => (
  <div data-testid="tooltip" data-title={title}>
    {children}
  </div>
);

export const Modal = ({ title, open, onClose, children }: ModalProps) => {
  if (!open) return null;
  
  return (
    <div data-testid="modal" data-title={title}>
      <button onClick={onClose} data-testid="modal-close">
        Close
      </button>
      {children}
    </div>
  );
};

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export const Toast = ({ message, type, onClose }: ToastProps) => (
  <div data-testid="toast" data-type={type}>
    {message}
    <button onClick={onClose} data-testid="toast-close">
      Close
    </button>
  </div>
);
