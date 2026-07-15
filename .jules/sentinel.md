## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2025-02-24 - SSRF Bypass via IPv6 Bracket Preservation in URL.hostname
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass in Asset Proxy
**Learning:** In Node.js (and standard WHATWG URL parsing), `URL.hostname` preserves the square brackets around IPv6 addresses (e.g., `[::1]`). If you check the string directly against `::1` without stripping the brackets first, it will fail to match, allowing an attacker to bypass private IP blocklists by passing a bracketed IPv6 URL.
**Prevention:** Always explicitly strip `[` and `]` brackets from `URL.hostname` using `.replace(/^\[|\]$/g, "")` before applying allowlist/denylist string matching to prevent bypasses.

## 2026-07-15 - Host Header Injection via X-Forwarded-Host
**Vulnerability:** Host Header Injection / Password Reset Poisoning
**Learning:** Relying on 'x-forwarded-host' to construct absolute public URLs allows attackers to spoof the host header and direct sensitive links (like password resets) to malicious domains.
**Prevention:** Prioritize server-configured environment variables like NEXT_PUBLIC_SITE_URL for constructing absolute public URLs, and never blindly trust client-provided headers for sensitive base URL generation.
