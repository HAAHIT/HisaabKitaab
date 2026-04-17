## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2025-02-27 - Weak Password Generation using Math.random()
**Vulnerability:** Weak Random Number Generation
**Learning:** `Math.random()` was used to generate random passwords, which is not cryptographically secure and can lead to predictable passwords.
**Prevention:** Always use `crypto.getRandomValues()` for generating random tokens, passwords, or any security-sensitive values in TypeScript/JavaScript.
