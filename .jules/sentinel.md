## 2026-04-18 - Insecure Randomness via Math.random() for Passwords
**Vulnerability:** Weak Password Generation
**Learning:** `Math.random()` is not cryptographically secure and can be easily predicted. Using it to generate passwords or security tokens creates a significant vulnerability.
**Prevention:** Always use `crypto.getRandomValues()` to generate cryptographically secure random values.

## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.
