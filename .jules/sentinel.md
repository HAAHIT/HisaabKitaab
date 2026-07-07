## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2025-02-24 - SSRF Bypass via IPv6 Bracket Preservation in URL.hostname
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass in Asset Proxy
**Learning:** In Node.js (and standard WHATWG URL parsing), `URL.hostname` preserves the square brackets around IPv6 addresses (e.g., `[::1]`). If you check the string directly against `::1` without stripping the brackets first, it will fail to match, allowing an attacker to bypass private IP blocklists by passing a bracketed IPv6 URL.
**Prevention:** Always explicitly strip `[` and `]` brackets from `URL.hostname` using `.replace(/^\[|\]$/g, "")` before applying allowlist/denylist string matching to prevent bypasses.

## 2025-02-24 - Host Header Injection and Open Redirect via Next.js Headers
**Vulnerability:** Host Header Injection and Open Redirect
**Learning:** Using `request.headers.get("x-forwarded-host")` to construct absolute URLs without fallback to a verified environment variable (like `NEXT_PUBLIC_SITE_URL`) allows an attacker to manipulate the Host header. Passing a malicious absolute URL to `new URL(pathOrUrl, getPublicBaseUrl(request))` causes the base URL to be overridden.
**Prevention:** To prevent Host Header Injection, prioritize securely configured environment variables over incoming request headers. For Open Redirects, always verify that the generated URL's `hostname` matches the expected base URL's `hostname` when using the `new URL` constructor to resolve relative paths.
