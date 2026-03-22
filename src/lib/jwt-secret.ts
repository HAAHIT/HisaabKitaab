const MISSING_JWT_SECRET_MESSAGE =
  "JWT_SECRET is required. Refusing to use a predictable fallback secret.";

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error(MISSING_JWT_SECRET_MESSAGE);
  }

  return new TextEncoder().encode(secret);
}
