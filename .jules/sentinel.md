## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2024-05-18 - [HIGH] Insecure Randomness in Password Generation
**Vulnerability:** Found `Math.random()` being used to generate user passwords in `src/app/(app)/settings/users/page.tsx` and `src/lib/utils.ts`.
**Learning:** `Math.random()` uses pseudo-random number generators (PRNG) which are predictable and not cryptographically secure, meaning an attacker could potentially guess generated passwords if they determine the PRNG seed or internal state.
**Prevention:** Always use `crypto.getRandomValues()` instead of `Math.random()` for generating random tokens, passwords, or any security-sensitive values to ensure cryptographic security. To seamlessly mimic `Math.random()`'s `[0, 1)` floating-point return, use `crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000`.
