## 2024-05-18 - Replaced Math.random with crypto.getRandomValues
**Vulnerability:** Weak pseudo-random number generator (Math.random) was used to generate sensitive data (passwords).
**Learning:** Math.random is predictable and should never be used for security-critical random generation.
**Prevention:** Always use the Web Crypto API (`crypto.getRandomValues()`) for generating secure tokens, passwords, or other sensitive random values.
