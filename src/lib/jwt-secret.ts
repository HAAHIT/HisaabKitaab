const MISSING_JWT_SECRET_MESSAGE =
  "JWT_SECRET is required. Refusing to use a predictable fallback secret.";
const WEAK_JWT_SECRET_MESSAGE =
  "JWT_SECRET must be at least 32 bytes. HS256 with a shorter key is brute-forceable.";

// HS256 requires a key of at least the hash output size (256 bits = 32 bytes)
// per RFC 7518 §3.2. A shorter key is brute-forceable; jose accepts it but
// we reject at startup so a misconfiguration cannot quietly weaken sessions.
const MIN_SECRET_BYTES = 32;

let cachedSecret: Uint8Array | null = null;

export function getJwtSecret() {
  if (cachedSecret) {
    return cachedSecret;
  }

  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error(MISSING_JWT_SECRET_MESSAGE);
  }

  const encoded = new TextEncoder().encode(secret);
  if (encoded.byteLength < MIN_SECRET_BYTES) {
    throw new Error(WEAK_JWT_SECRET_MESSAGE);
  }

  cachedSecret = encoded;
  return encoded;
}
