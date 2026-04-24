## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2024-04-24 - [CRITICAL] Fix insecure random password generation
**Vulnerability:** Weak random password generation using `Math.random()`. `Math.random()` does not provide cryptographically secure random numbers, making generated passwords potentially predictable.
**Learning:** `Math.random()` was used for security-sensitive password generation in multiple files (`src/app/(app)/settings/users/page.tsx` and `src/lib/utils.ts`), compromising the unpredictability of user passwords.
**Prevention:** Always use `crypto.getRandomValues()` instead of `Math.random()` for generating random tokens, passwords, or any security-sensitive values. `crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000` safely mimics `Math.random()` return value while being cryptographically secure.
