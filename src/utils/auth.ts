import { type SessionPayload } from '../api/smallocator';

// Format the message according to EIP-4361
export function formatMessage(session: SessionPayload): string {
  return [
    `${session.domain} wants you to sign in with your Ethereum account:`,
    session.address,
    '',
    session.statement,
    '',
    `URI: ${session.uri}`,
    `Version: ${session.version}`,
    `Chain ID: ${session.chainId}`,
    `Nonce: ${session.nonce}`,
    `Issued At: ${session.issuedAt}`,
    `Expiration Time: ${session.expirationTime}`,
  ].join('\n');
}
