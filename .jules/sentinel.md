## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.
## 2024-05-07 - Fix weak PRNG in password generation
**Vulnerability:** Use of Cryptographically Weak Pseudo-Random Number Generator (Math.random()) for generating passwords.
**Learning:** Math.random() is predictable and unsuitable for generating sensitive values like passwords.
**Prevention:** Always use crypto.getRandomValues() instead of Math.random() for generating random tokens, passwords, or any security-sensitive values. To seamlessly mimic Math.random()'s [0, 1) floating-point return, use crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000.
