export const useToast = () => {
  const showToast = (message: string, type: 'success' | 'error') => {
    void message; // Explicitly mark as intentionally unused
    void type; // Explicitly mark as intentionally unused
  };

  return { showToast };
};
