export interface CompactMessage {
  arbiter: string;
  sponsor: string;
  nonce: string;
  expires: string;
  id: string;
  amount: string;
  witnessTypeString: string;
  witnessHash: string;
}

export interface SignedCompact extends CompactMessage {
  userSignature: string;
  smallocatorSignature: string;
}

export interface CompactRequestPayload {
  chainId: string;
  compact: CompactMessage;
}

export interface CompactResponse {
  hash: string;
  signature: string;
  nonce: string;
}

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

export interface EIP712TypeDefinition {
  EIP712Domain: Array<{ name: string; type: string }>;
  Compact: Array<{ name: string; type: string }>;
}

export interface EIP712Payload {
  domain: EIP712Domain;
  message: CompactMessage & { smallocatorSignature: string };
  primaryType: 'Compact';
  types: EIP712TypeDefinition;
}
