import { Mock } from 'vitest';
import type { UseAccountReturnType } from 'wagmi';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Vi {
    interface Assertion {
      toHaveBeenCalledWith: (...args: unknown[]) => Assertion;
    }
  }
}

export type MockType = Mock;

export type { UseAccountReturnType };
