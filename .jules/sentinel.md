## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2025-02-24 - SSRF Bypass via IPv6 Bracket Preservation in URL.hostname
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass in Asset Proxy
**Learning:** In Node.js (and standard WHATWG URL parsing), `URL.hostname` preserves the square brackets around IPv6 addresses (e.g., `[::1]`). If you check the string directly against `::1` without stripping the brackets first, it will fail to match, allowing an attacker to bypass private IP blocklists by passing a bracketed IPv6 URL.
**Prevention:** Always explicitly strip `[` and `]` brackets from `URL.hostname` using `.replace(/^\[|\]$/g, "")` before applying allowlist/denylist string matching to prevent bypasses.

## 2024-10-24 - Host Header Injection in URL generation
**Vulnerability:** Host Header Injection leading to token hijacking (e.g., password reset link).
**Learning:** Relying solely on incoming `x-forwarded-host` or `host` headers to generate absolute URLs on the server allows attackers to spoof the host. If this logic is used to construct sensitive links (like password reset URLs sent via email), the attacker can hijack the token.
**Prevention:** Prioritize a securely configured environment variable (like `process.env.NEXT_PUBLIC_SITE_URL`) for generating absolute URLs instead of dynamically reading host headers from the request.
