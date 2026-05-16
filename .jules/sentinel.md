## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2024-05-18 - Insecure Random Number Generation for Passwords
**Vulnerability:** The application used `Math.random()` to generate user passwords in both the frontend (User Management Page) and utility functions.
**Learning:** `Math.random()` is not cryptographically secure and the generated pseudo-random sequence could theoretically be predicted, leading to compromised passwords.
**Prevention:** Always use `crypto.getRandomValues()` when generating security-sensitive values like passwords, tokens, or cryptographic keys. To mimic `Math.random()` behavior of returning a float `[0, 1)`, use `crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000`.
