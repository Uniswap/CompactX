import { BroadcastRequest, Mandate } from '../types/broadcast';
import {
  keccak256,
  recoverAddress,
  toBytes,
  parseCompactSignature,
  compactSignatureToSignature,
  serializeSignature,
  encodeAbiParameters,
} from 'viem';

// Chain-specific prefixes for signature verification
const CHAIN_PREFIXES = {
  ethereum: '0x1901afbd5f3d34c216b31ba8b82d0b32ae91e4edea92dd5bbf4c1ad028f72364a211',
  unichain: '0x190150e2b173e1ac2eac4e4995e45458f4cd549c256c423a041bf17d0c0a4a736d2c',
  base: '0x1901a1324f3bfe91ee592367ae7552e9348145e65b410335d72e4507dcedeb41bf52',
  optimism: '0x1901ea25de9c16847077fe9d95916c29598dc64f4850ba02c5dbe7800d2e2ecb338e',
} as const;

// Allocator address for signature verification
const ALLOCATOR_ADDRESS = '0x51044301738Ba2a27bd9332510565eBE9F03546b';

export class BroadcastApiClient {
  private deriveClaimHash(
    arbiter: string,
    sponsor: string,
    nonce: string,
    expiration: string,
    id: string,
    amount: string,
    mandate: Mandate
  ): `0x${string}` {
    // First derive the mandate hash
    const mandateHash = this.deriveMandateHash(mandate);

    // Calculate the COMPACT_TYPEHASH
    const COMPACT_TYPE_STRING =
      'Compact(address arbiter,address sponsor,uint256 nonce,uint256 expires,uint256 id,uint256 amount,Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)';
    const COMPACT_TYPEHASH = keccak256(toBytes(COMPACT_TYPE_STRING));

    // Encode all parameters including the derived mandate hash
    const encodedParameters = encodeAbiParameters(
      [
        { type: 'bytes32' }, // COMPACT_TYPEHASH
        { type: 'address' }, // arbiter
        { type: 'address' }, // sponsor
        { type: 'uint256' }, // nonce
        { type: 'uint256' }, // expires
        { type: 'uint256' }, // id
        { type: 'uint256' }, // amount
        { type: 'bytes32' }, // mandateHash
      ],
      [
        COMPACT_TYPEHASH,
        arbiter as `0x${string}`,
        sponsor as `0x${string}`,
        BigInt(nonce),
        BigInt(expiration),
        BigInt(id),
        BigInt(amount),
        mandateHash,
      ]
    );

    const claimHash = keccak256(encodedParameters);

    console.log({ claimHash, mandateHash });

    return claimHash;
  }

  private deriveMandateHash(mandate: Mandate): `0x${string}` {
    const MANDATE_TYPE_STRING =
      'Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)';
    const MANDATE_TYPEHASH = keccak256(toBytes(MANDATE_TYPE_STRING));
    const encodedParameters = encodeAbiParameters(
      [
        'bytes32',
        'uint256',
        'address',
        'address',
        'uint256',
        'address',
        'uint256',
        'uint256',
        'uint256',
        'bytes32',
      ].map(type => ({ type })),
      [
        MANDATE_TYPEHASH,
        BigInt(mandate.chainId),
        mandate.tribunal as `0x${string}`,
        mandate.recipient as `0x${string}`,
        BigInt(parseInt(mandate.expires)),
        mandate.token as `0x${string}`,
        BigInt(mandate.minimumAmount),
        BigInt(mandate.baselinePriorityFee),
        BigInt(mandate.scalingFactor),
        mandate.salt as `0x${string}`,
      ]
    );

    return keccak256(encodedParameters);
  }

  private async verifySignature(
    claimHash: string,
    signature: string,
    expectedSigner: string,
    chainPrefix: string
  ): Promise<boolean> {
    try {
      // Log input parameters
      console.log('Verifying signature with:', {
        claimHash,
        signature,
        expectedSigner,
        chainPrefix,
      });

      // Ensure hex values have 0x prefix
      const normalizedClaimHash = claimHash.startsWith('0x') ? claimHash : `0x${claimHash}`;
      const normalizedPrefix = chainPrefix.startsWith('0x') ? chainPrefix : `0x${chainPrefix}`;
      const normalizedSignature = signature.startsWith('0x') ? signature : `0x${signature}`;

      // Convert hex strings to bytes and concatenate
      const prefixBytes = toBytes(normalizedPrefix);
      const claimHashBytes = toBytes(normalizedClaimHash);

      console.log('Intermediate values:', {
        normalizedPrefix,
        normalizedClaimHash,
        normalizedSignature,
        prefixBytesLength: prefixBytes.length,
        claimHashBytesLength: claimHashBytes.length,
      });

      // Concatenate bytes
      const messageBytes = new Uint8Array(prefixBytes.length + claimHashBytes.length);
      messageBytes.set(prefixBytes);
      messageBytes.set(claimHashBytes, prefixBytes.length);

      // Get the digest
      const digest = keccak256(messageBytes);

      console.log('Computed values:', {
        messageBytes: Array.from(messageBytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join(''),
        digest,
      });

      console.log({ digest });

      // Convert compact signature to full signature
      const parsedCompactSig = parseCompactSignature(normalizedSignature as `0x${string}`);
      const fullSig = compactSignatureToSignature(parsedCompactSig);
      const serializedSig = serializeSignature(fullSig);

      console.log('Signature conversion:', {
        parsedCompactSig,
        fullSig,
        serializedSig,
      });

      // Recover the signer address
      const recoveredAddress = await recoverAddress({
        hash: digest,
        signature: serializedSig,
      });

      // Compare recovered address with expected signer
      return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  private baseUrl: string;

  constructor() {
    const baseUrl = import.meta.env.VITE_BROADCAST_URL;
    if (!baseUrl) {
      throw new Error('VITE_BROADCAST_URL environment variable is not set');
    }
    this.baseUrl = baseUrl;
  }

  async broadcast(request: BroadcastRequest): Promise<{ success: boolean }> {
    // Derive claim hash
    const claimHash = this.deriveClaimHash(
      request.compact.arbiter,
      request.compact.sponsor,
      request.compact.nonce || '',
      request.compact.expires,
      request.compact.id,
      request.compact.amount,
      request.compact.mandate
    );

    // Get chain prefix based on chainId
    let chainPrefix: string;
    switch (request.chainId) {
      case '1':
        chainPrefix = CHAIN_PREFIXES.ethereum;
        break;
      case '10':
        chainPrefix = CHAIN_PREFIXES.optimism;
        break;
      case '8453':
        chainPrefix = CHAIN_PREFIXES.base;
        break;
      case '130':
        chainPrefix = CHAIN_PREFIXES.unichain;
        break;
      default:
        throw new Error(`Unsupported chain ID: ${request.chainId}`);
    }

    try {
      // Verify sponsor signature
      const isSponsorValid = await this.verifySignature(
        claimHash,
        request.sponsorSignature,
        request.compact.sponsor,
        chainPrefix
      );
      if (!isSponsorValid) {
        throw new Error('Invalid sponsor signature');
      }

      // Verify allocator signature
      const isAllocatorValid = await this.verifySignature(
        claimHash,
        request.allocatorSignature,
        ALLOCATOR_ADDRESS,
        chainPrefix
      );
      if (!isAllocatorValid) {
        throw new Error('Invalid allocator signature');
      }

      const response = await fetch(`${this.baseUrl}/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error('Failed to broadcast message');
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to broadcast message');
    }
  }
}

// Export a singleton instance
export const broadcast = new BroadcastApiClient();
