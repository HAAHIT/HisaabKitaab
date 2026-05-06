## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2024-05-06 - Insecure Randomness in Password Generation
**Vulnerability:** Found `Math.random()` used to generate new passwords in `src/lib/utils.ts` and `src/app/(app)/settings/users/page.tsx`.
**Learning:** `Math.random()` generates predictable values. Using it for passwords allows attackers to guess credentials if they know the seed or enough outputs.
**Prevention:** Always enforce the use of `crypto.getRandomValues()` or a secure cryptographic library for any authentication token or password generation instead of standard math libraries.
