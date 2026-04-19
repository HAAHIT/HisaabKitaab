## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2024-10-27 - Insecure Randomness in Password Generation
**Vulnerability:** Weak, predictable random string generation
**Learning:** The built-in `Math.random()` was used for generating passwords, which relies on a pseudo-random number generator that is cryptographically insecure and predictable.
**Prevention:** Always use `crypto.getRandomValues()` instead of `Math.random()` for generating random tokens, passwords, or any security-sensitive values to ensure cryptographic security.
