## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2025-02-24 - SSRF Bypass via IPv6 Bracket Preservation in URL.hostname
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass in Asset Proxy
**Learning:** In Node.js (and standard WHATWG URL parsing), `URL.hostname` preserves the square brackets around IPv6 addresses (e.g., `[::1]`). If you check the string directly against `::1` without stripping the brackets first, it will fail to match, allowing an attacker to bypass private IP blocklists by passing a bracketed IPv6 URL.
**Prevention:** Always explicitly strip `[` and `]` brackets from `URL.hostname` using `.replace(/^\[|\]$/g, "")` before applying allowlist/denylist string matching to prevent bypasses.

## 2024-05-24 - Host Header Injection and URL constructor Bypass
**Vulnerability:** Host Header Injection via `x-forwarded-host` fallback and Open Redirect / XSS bypass through `new URL(path, base)` resolving to absolute inputs.
**Learning:** `getPublicBaseUrl` blindly trusted `x-forwarded-host` before environment variables, allowing attackers to spoof absolute URLs in emails/redirects. Additionally, when using `new URL(path, base)`, an absolute path (like `https://evil.com` or `javascript:alert(1)`) entirely overrides the base URL, bypassing path-based logic or string prefixes.
**Prevention:** Always prioritize securely configured environment variables like `process.env.NEXT_PUBLIC_SITE_URL` for absolute URL generation. For the `URL` constructor, always strictly enforce that `url.hostname` and `url.protocol` match the expected base URL's hostname and protocol.
