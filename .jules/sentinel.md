## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2024-05-18 - Insecure Randomness in Password Generation
**Vulnerability:** Weak random number generation using Math.random() for password generation.
**Learning:** Math.random() is predictable and susceptible to cryptographic attacks; its output is not cryptographically secure, which is dangerous when creating authentication credentials like user passwords.
**Prevention:** Always substitute Math.random() with Web Crypto API's crypto.getRandomValues() when dealing with secure strings or tokens.
