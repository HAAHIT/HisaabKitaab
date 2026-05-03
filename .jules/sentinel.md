## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2024-05-03 - Insecure Randomness in Password Generation
**Vulnerability:** Weak PRNG used for generating passwords
**Learning:** `Math.random()` is not cryptographically secure and should never be used for security-sensitive operations like password or token generation, as its outputs can be predicted.
**Prevention:** Always use `crypto.getRandomValues()` to generate cryptographically secure random numbers instead of `Math.random()`.
