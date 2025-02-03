import { type PublicClient } from 'viem';

export const mockPublicClient = {
  request: async () => '0x0',
  getChainId: () => 1,
} as unknown as PublicClient;
