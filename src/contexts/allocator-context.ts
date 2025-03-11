import { createContext } from 'react';
import type { AllocatorType } from '../types';

export interface AllocatorContextType {
  selectedAllocator: AllocatorType;
  setSelectedAllocator: (allocator: AllocatorType) => void;
}

export const AllocatorContext = createContext<AllocatorContextType | undefined>(undefined);
