## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2025-02-24 - SSRF Bypass via IPv6 Bracket Preservation in URL.hostname
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass in Asset Proxy
**Learning:** In Node.js (and standard WHATWG URL parsing), `URL.hostname` preserves the square brackets around IPv6 addresses (e.g., `[::1]`). If you check the string directly against `::1` without stripping the brackets first, it will fail to match, allowing an attacker to bypass private IP blocklists by passing a bracketed IPv6 URL.
**Prevention:** Always explicitly strip `[` and `]` brackets from `URL.hostname` using `.replace(/^\[|\]$/g, "")` before applying allowlist/denylist string matching to prevent bypasses.

## 2025-02-28 - Open Redirect and XSS via URL Constructor Override
**Vulnerability:** Open Redirect / Host Header Injection / XSS
**Learning:** Using `new URL(pathOrUrl, baseUrl)` where `pathOrUrl` is attacker-controlled can completely override the base URL if an absolute URL (e.g., `https://evil.com` or `javascript:alert(1)`) is provided. This renders prefix-based validation like blocking `//` insufficient for determining if a redirect is safe. Furthermore, determining the base URL via `X-Forwarded-Host` without falling back to a securely configured environment variable risks Host Header Injection.
**Prevention:** Always verify the generated URL's `hostname` matches the expected base URL's `hostname` after constructing it. Prioritize environment variables like `process.env.NEXT_PUBLIC_SITE_URL` over incoming request headers for the base URL.
