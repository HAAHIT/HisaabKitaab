## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.
## 2025-04-20 - Insecure Randomness in Password Generation
**Vulnerability:** Weak Password Generation
**Learning:** `Math.random()` was used for generating passwords, which is not cryptographically secure and predictable.
**Prevention:** Always use `crypto.getRandomValues()` for generating random tokens, passwords, or security-sensitive values.
