import { getAddress, recoverMessageAddress, type Hex } from 'viem';

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
  notBefore?: string;
}

export interface SiweVerifyOptions {
  now?: Date;
  expectedDomain?: string;
  expectedUri?: string;
  expectedChainId?: number;
  expectedNonce?: string;
  maxAgeMs?: number;
}

export interface SiweVerifyResult {
  valid: boolean;
  address?: string;
  recoveredAddress?: string;
  fields: SiweFields;
  cryptographicallyVerified: boolean;
  checks: {
    addressFormat: boolean;
    signatureFormat: boolean;
    signatureValid: boolean;
    domainMatches: boolean;
    uriMatches: boolean;
    chainMatches: boolean;
    nonceMatches: boolean;
    timeValid: boolean;
  };
  reason?: string;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const SIGNATURE_RE = /^0x[0-9a-fA-F]{130}$/;
const NONCE_RE = /^[A-Za-z0-9]{8,}$/;

export function parseSiweMessage(message: string): SiweFields {
  const lines = message.replace(/\r\n/g, '\n').split('\n');
  const fields: SiweFields = {};
  const header = lines[0] ?? '';
  const match = header.match(/^([^\s]+) wants you to sign in with your Ethereum account:$/);
  if (match) fields.domain = match[1];
  if (lines[1] && ADDRESS_RE.test(lines[1].trim())) fields.address = lines[1].trim();
  const statement = lines.slice(3).find((line) => line && !line.includes(':'));
  if (statement) fields.statement = statement;
  for (const line of lines) {
    const kv = line.match(/^([A-Za-z ]+):\s*(.+)$/);
    if (!kv) continue;
    const key = kv[1]?.trim().toLowerCase();
    const value = kv[2]?.trim();
    if (!key || !value) continue;
    if (key === 'uri') fields.uri = value;
    else if (key === 'version') fields.version = value;
    else if (key === 'chain id') fields.chainId = Number(value);
    else if (key === 'nonce') fields.nonce = value;
    else if (key === 'issued at') fields.issuedAt = value;
    else if (key === 'expiration time') fields.expirationTime = value;
    else if (key === 'not before') fields.notBefore = value;
  }
  return fields;
}

export async function verifySiwe(
  message: string,
  signature: string,
  options: SiweVerifyOptions | Date = {},
): Promise<SiweVerifyResult> {
  const opts = options instanceof Date ? { now: options } : options;
  const now = opts.now ?? new Date();
  const fields = parseSiweMessage(message);
  const addressFormat = !!fields.address && ADDRESS_RE.test(fields.address);
  const signatureFormat = SIGNATURE_RE.test(signature);
  const domainMatches = !opts.expectedDomain || fields.domain === opts.expectedDomain;
  const uriMatches = !opts.expectedUri || fields.uri === opts.expectedUri;
  const chainMatches = !opts.expectedChainId || fields.chainId === opts.expectedChainId;
  const nonceMatches = !!fields.nonce && NONCE_RE.test(fields.nonce) &&
    (!opts.expectedNonce || fields.nonce === opts.expectedNonce);
  let timeValid = true;
  const issuedAt = fields.issuedAt ? Date.parse(fields.issuedAt) : NaN;
  if (!Number.isFinite(issuedAt) || issuedAt > now.getTime() + 60_000) timeValid = false;
  if (Number.isFinite(issuedAt) && opts.maxAgeMs && now.getTime() - issuedAt > opts.maxAgeMs) timeValid = false;
  if (fields.notBefore) {
    const notBefore = Date.parse(fields.notBefore);
    if (!Number.isFinite(notBefore) || now.getTime() < notBefore) timeValid = false;
  }
  if (fields.expirationTime) {
    const expiry = Date.parse(fields.expirationTime);
    if (!Number.isFinite(expiry) || now.getTime() > expiry) timeValid = false;
  }

  let recoveredAddress: string | undefined;
  let signatureValid = false;
  if (addressFormat && signatureFormat) {
    try {
      recoveredAddress = await recoverMessageAddress({ message, signature: signature as Hex });
      signatureValid = getAddress(recoveredAddress) === getAddress(fields.address!);
    } catch {
      signatureValid = false;
    }
  }
  const valid = addressFormat && signatureFormat && signatureValid && domainMatches && uriMatches &&
    chainMatches && nonceMatches && timeValid && fields.version === '1';
  const reason = !addressFormat ? 'invalid or missing address'
    : !signatureFormat ? 'signature is not a 65-byte hex string'
      : !signatureValid ? 'signature does not match the claimed address'
        : !domainMatches ? 'domain mismatch'
          : !uriMatches ? 'uri mismatch'
            : !chainMatches ? 'chain id mismatch'
              : !nonceMatches ? 'nonce missing or mismatch'
                : !timeValid ? 'message time window is invalid'
                  : fields.version !== '1' ? 'unsupported SIWE version'
                    : undefined;
  return {
    valid,
    address: fields.address,
    recoveredAddress,
    fields,
    cryptographicallyVerified: signatureValid,
    checks: { addressFormat, signatureFormat, signatureValid, domainMatches, uriMatches, chainMatches, nonceMatches, timeValid },
    reason,
  };
}
