## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2024-05-09 - Weak Random Number Generation
**Vulnerability:** Use of `Math.random()` for generating passwords.
**Learning:** `Math.random()` is not cryptographically secure and can lead to predictable passwords.
**Prevention:** Use `crypto.getRandomValues()` for generating random tokens, passwords, or any security-sensitive values.
