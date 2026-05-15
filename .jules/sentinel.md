## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2026-05-15 - Predictable Random Number Generation in Passwords
**Vulnerability:** Weak PRNG via `Math.random()` for password generation
**Learning:** Using `Math.random()` for generating sensitive strings like passwords is computationally predictable and poses a security risk, even in client-side tools.
**Prevention:** Always use `crypto.getRandomValues()` for cryptographically secure pseudo-random number generation when dealing with auth or secrets.
