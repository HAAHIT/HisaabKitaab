## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2026-05-02 - Insecure Password Generation using Math.random()
**Vulnerability:** Weak Random Number Generation for Passwords
**Learning:** `Math.random()` was used to generate random user passwords, which is not cryptographically secure and could allow an attacker to predict generated passwords.
**Prevention:** Always use `crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000` or similar cryptographically secure functions for generating any security-sensitive values like passwords or tokens.
