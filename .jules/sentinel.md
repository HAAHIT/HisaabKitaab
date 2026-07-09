## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2025-02-24 - SSRF Bypass via IPv6 Bracket Preservation in URL.hostname
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass in Asset Proxy
**Learning:** In Node.js (and standard WHATWG URL parsing), `URL.hostname` preserves the square brackets around IPv6 addresses (e.g., `[::1]`). If you check the string directly against `::1` without stripping the brackets first, it will fail to match, allowing an attacker to bypass private IP blocklists by passing a bracketed IPv6 URL.
**Prevention:** Always explicitly strip `[` and `]` brackets from `URL.hostname` using `.replace(/^\[|\]$/g, "")` before applying allowlist/denylist string matching to prevent bypasses.

## 2025-02-25 - Host Header Injection in URL Construction
**Vulnerability:** Host Header Injection and Open Redirects via x-forwarded-host
**Learning:** Constructing base URLs by trusting `x-forwarded-host` or similar request headers can allow attackers to inject their own domains. This leads to absolute URLs (e.g. password reset links) pointing to malicious servers. Furthermore, `new URL(pathOrUrl, base)` will discard the base entirely if `pathOrUrl` is already an absolute URL (e.g. `javascript:alert(1)` or `https://evil.com`), leading to Open Redirects/XSS.
**Prevention:** Always prioritize securely configured environment variables (like `process.env.NEXT_PUBLIC_SITE_URL`) over user-supplied headers for the base URL. When resolving user-provided relative paths with `new URL()`, explicitly verify that the resulting `url.origin === baseUrl.origin` to block absolute URL overrides.
