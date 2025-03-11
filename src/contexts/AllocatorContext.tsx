import { useState, ReactNode } from 'react';
import { AllocatorContext } from './allocator-context';
import type { AllocatorType } from '../types';

export function AllocatorProvider({ children }: { children: ReactNode }) {
  // Initialize with Autocator as the default allocator
  const [selectedAllocator, setSelectedAllocator] = useState<AllocatorType>('AUTOCATOR');

  return (
    <AllocatorContext.Provider value={{ selectedAllocator, setSelectedAllocator }}>
      {children}
    </AllocatorContext.Provider>
  );
}
