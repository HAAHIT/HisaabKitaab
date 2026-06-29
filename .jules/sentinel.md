## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2025-02-24 - SSRF Bypass via IPv6 Bracket Preservation in URL.hostname
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass in Asset Proxy
**Learning:** In Node.js (and standard WHATWG URL parsing), `URL.hostname` preserves the square brackets around IPv6 addresses (e.g., `[::1]`). If you check the string directly against `::1` without stripping the brackets first, it will fail to match, allowing an attacker to bypass private IP blocklists by passing a bracketed IPv6 URL.
**Prevention:** Always explicitly strip `[` and `]` brackets from `URL.hostname` using `.replace(/^\[|\]$/g, "")` before applying allowlist/denylist string matching to prevent bypasses.
## 2024-XX-XX - Host Header Injection in URL generation
**Vulnerability:** Host Header Injection
**Learning:** Relying purely on `x-forwarded-host` or `host` headers for constructing public URLs can lead to Host Header Injection. An attacker can set a custom host header, which might then be used in password reset links or Open Redirects, allowing them to steal tokens.
**Prevention:** Prioritize `process.env.NEXT_PUBLIC_SITE_URL` when constructing base URLs. Only fallback to headers if absolutely necessary or in local development.
