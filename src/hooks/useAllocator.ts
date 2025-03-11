import { useContext } from 'react';
import { AllocatorContext } from '../contexts/allocator-context';

export function useAllocator() {
  const context = useContext(AllocatorContext);
  if (!context) {
    throw new Error('useAllocator must be used within an AllocatorProvider');
  }
  return context;
}
