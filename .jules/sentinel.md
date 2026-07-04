## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2025-02-24 - SSRF Bypass via IPv6 Bracket Preservation in URL.hostname
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass in Asset Proxy
**Learning:** In Node.js (and standard WHATWG URL parsing), `URL.hostname` preserves the square brackets around IPv6 addresses (e.g., `[::1]`). If you check the string directly against `::1` without stripping the brackets first, it will fail to match, allowing an attacker to bypass private IP blocklists by passing a bracketed IPv6 URL.
**Prevention:** Always explicitly strip `[` and `]` brackets from `URL.hostname` using `.replace(/^\[|\]$/g, "")` before applying allowlist/denylist string matching to prevent bypasses.

## 2025-02-25 - Host Header Injection via Untrusted Request Headers
**Vulnerability:** Host Header Injection (leading to Password Reset Poisoning)
**Learning:** Relying on incoming request headers like `X-Forwarded-Host` or `Host` to construct absolute URLs (e.g., for password reset links or emails) allows an attacker to spoof the host and generate links pointing to their malicious domain.
**Prevention:** Always prioritize securely configured environment variables like `process.env.NEXT_PUBLIC_SITE_URL` over incoming request headers when generating absolute URLs.
