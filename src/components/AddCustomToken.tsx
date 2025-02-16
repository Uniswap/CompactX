import { useState } from 'react';
import { useCustomTokens } from '../hooks/useCustomTokens';
import { useChainId } from 'wagmi';
import { Toast } from './Toast';
import { useToast } from '../hooks/useToast';
import { isAddress } from 'viem';

interface FormValues {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

export function AddCustomToken() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const chainId = useChainId();
  const { addCustomToken } = useCustomTokens();
  const [formValues, setFormValues] = useState<Partial<FormValues>>({});
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const { toast, showToast, hideToast } = useToast();

  const handleOpen = () => {
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setFormValues({});
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof FormValues, string>> = {};
    
    if (!formValues.address) {
      errors.address = 'Please input token address';
    } else if (!isAddress(formValues.address)) {
      errors.address = 'Invalid address';
    }
    
    if (!formValues.name) {
      errors.name = 'Please input token name';
    }
    
    if (!formValues.symbol) {
      errors.symbol = 'Please input token symbol';
    }
    
    if (!formValues.decimals) {
      errors.decimals = 'Please input token decimals';
    } else if (formValues.decimals < 0 || formValues.decimals > 18) {
      errors.decimals = 'Decimals must be between 0 and 18';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      await addCustomToken({
        chainId,
        address: formValues.address!,
        name: formValues.name!,
        symbol: formValues.symbol!,
        decimals: formValues.decimals!,
      });
      showToast('Token added successfully', 'success');
      handleClose();
    } catch {
      showToast('Failed to add token', 'error');
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="px-4 py-2 bg-[#00ff00]/10 hover:bg-[#00ff00]/20 text-[#00ff00] rounded-lg transition-colors"
      >
        Add Custom Token
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">Add Custom Token</h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Token Address
                </label>
                <input
                  type="text"
                  value={formValues.address || ''}
                  onChange={(e) => setFormValues(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="0x..."
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00ff00]/50 text-white"
                />
                {formErrors.address && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.address}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Token Name
                </label>
                <input
                  type="text"
                  value={formValues.name || ''}
                  onChange={(e) => setFormValues(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Token Name"
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00ff00]/50 text-white"
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Token Symbol
                </label>
                <input
                  type="text"
                  value={formValues.symbol || ''}
                  onChange={(e) => setFormValues(prev => ({ ...prev, symbol: e.target.value }))}
                  placeholder="TOKEN"
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00ff00]/50 text-white"
                />
                {formErrors.symbol && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.symbol}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Decimals
                </label>
                <input
                  type="number"
                  value={formValues.decimals || ''}
                  onChange={(e) => setFormValues(prev => ({ ...prev, decimals: Number(e.target.value) }))}
                  placeholder="18"
                  min="0"
                  max="18"
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00ff00]/50 text-white"
                />
                {formErrors.decimals && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.decimals}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full px-4 py-2 bg-[#00ff00]/10 hover:bg-[#00ff00]/20 text-[#00ff00] rounded-lg transition-colors"
              >
                Add Token
              </button>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={hideToast}
        />
      )}
    </>
  );
}
