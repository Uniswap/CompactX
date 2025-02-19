import { hexToBigInt, getAddress } from 'viem';

/**
 * Converts lock parameters to a unique ID.
 * The ID consists of:
 *  - Bit 255: scope (0 for multichain, 1 for single chain)
 *  - Bits 252-254: reset period
 *  - Bits 160-251: allocator ID (92 bits)
 *  - Bits 0-159: token address (20 bytes = 160 bits)
 *
 * @param isMultichain Whether the lock is multichain (maps to scope)
 * @param resetPeriod Reset period (0-7)
 * @param allocatorId Allocator ID as string
 * @param token Token address as hex string
 * @returns The derived resource lock ID as a BigInt
 */
export function toId(
  isMultichain: boolean,
  resetPeriod: number,
  allocatorId: string,
  token: string
): bigint {
  // Validate inputs
  if (resetPeriod < 0 || resetPeriod > 7) {
    throw new Error('Reset period must be between 0 and 7');
  }
  // Validate token is a valid address and normalize it
  const normalizedToken = getAddress(token);

  // Convert isMultichain to scope (inverse relationship)
  const scope = isMultichain ? 0n : 1n;

  // Convert allocatorId from decimal string to BigInt
  const allocatorBigInt = BigInt(allocatorId);
  if (allocatorBigInt > (1n << 92n) - 1n) {
    throw new Error('AllocatorId must fit in 92 bits');
  }

  // Convert token address to BigInt using viem
  const tokenBigInt = hexToBigInt(normalizedToken);

  // Perform bitwise operations
  const scopeBits = scope << 255n;
  const resetPeriodBits = BigInt(resetPeriod) << 252n;
  const allocatorBits = allocatorBigInt << 160n;

  console.log('Lock ID calculation components:', {
    input: {
      isMultichain,
      resetPeriod,
      allocatorId,
      token: normalizedToken,
    },
    intermediate: {
      scope: scope.toString(),
      scopeBits: '0x' + scopeBits.toString(16),
      resetPeriodBits: '0x' + resetPeriodBits.toString(16),
      allocatorBits: '0x' + allocatorBits.toString(16),
      tokenBits: '0x' + tokenBigInt.toString(16),
    },
  });

  // Combine all bits using bitwise OR
  const id = scopeBits | resetPeriodBits | allocatorBits | tokenBigInt;

  return id;
}
