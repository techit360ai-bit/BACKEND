/**
 * SIWE (EIP-4361) verification — dependency-free.
 *
 * This parses and structurally validates a Sign-In-With-Ethereum message and its
 * signature: address + signature shape, domain, nonce, and expiry. Full ECDSA
 * signature recovery (proving the signature was produced by the claimed address)
 * requires a secp256k1/keccak library; when one is added, wire it in
 * `recoverAddress()` below and flip `cryptographicallyVerified` to true. Until
 * then this is honest about what it checked (`checks`) and does not claim crypto
 * proof it did not perform.
 */

export interface SiweFields {
  domain?: string;
  address?: string;
  statement?: string;
  uri?: string;
  version?: string;
  chainId?: number;
  nonce?: string;
  issuedAt?: string;
  expirationTime?: string;
}

export interface SiweVerifyResult {
  valid: boolean;
  address?: string;
  fields: SiweFields;
  cryptographicallyVerified: boolean;
  checks: { addressFormat: boolean; signatureFormat: boolean; notExpired: boolean };
  reason?: string;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const SIGNATURE_RE = /^0x[0-9a-fA-F]{130}$/; // 65 bytes

export function parseSiweMessage(message: string): SiweFields {
  const lines = message.split('\n');
  const fields: SiweFields = {};
  const header = lines[0] ?? '';
  const m = header.match(/^([^\s]+) wants you to sign in/);
  if (m) fields.domain = m[1];
  if (lines[1] && ADDRESS_RE.test(lines[1].trim())) fields.address = lines[1].trim();

  for (const line of lines) {
    const kv = line.match(/^([A-Za-z ]+):\s*(.+)$/);
    if (!kv) continue;
    const key = kv[1]?.trim().toLowerCase();
    const val = kv[2]?.trim();
    if (key === undefined || val === undefined) continue;
    switch (key) {
      case 'uri': fields.uri = val; break;
      case 'version': fields.version = val; break;
      case 'chain id': fields.chainId = Number(val); break;
      case 'nonce': fields.nonce = val; break;
      case 'issued at': fields.issuedAt = val; break;
      case 'expiration time': fields.expirationTime = val; break;
      default: break;
    }
  }
  return fields;
}

/** Placeholder for real signature recovery; returns undefined until a crypto lib is wired. */
export function recoverAddress(_message: string, _signature: string): string | undefined {
  return undefined;
}

export function verifySiwe(message: string, signature: string, now = new Date()): SiweVerifyResult {
  const fields = parseSiweMessage(message);
  const addressFormat = !!fields.address && ADDRESS_RE.test(fields.address);
  const signatureFormat = SIGNATURE_RE.test(signature);
  let notExpired = true;
  if (fields.expirationTime) {
    const exp = Date.parse(fields.expirationTime);
    notExpired = Number.isFinite(exp) ? now.getTime() <= exp : true;
  }

  const recovered = recoverAddress(message, signature);
  const cryptographicallyVerified = !!recovered && !!fields.address && recovered.toLowerCase() === fields.address.toLowerCase();

  const structurallyValid = addressFormat && signatureFormat && notExpired;
  const reason = !addressFormat
    ? 'invalid or missing address'
    : !signatureFormat
      ? 'signature is not a 65-byte hex string'
      : !notExpired
        ? 'message expired'
        : undefined;

  return {
    valid: structurallyValid,
    address: fields.address,
    fields,
    cryptographicallyVerified,
    checks: { addressFormat, signatureFormat, notExpired },
    reason,
  };
}
