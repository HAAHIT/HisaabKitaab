## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2025-02-24 - SSRF Bypass via IPv6 Bracket Preservation in URL.hostname
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass in Asset Proxy
**Learning:** In Node.js (and standard WHATWG URL parsing), `URL.hostname` preserves the square brackets around IPv6 addresses (e.g., `[::1]`). If you check the string directly against `::1` without stripping the brackets first, it will fail to match, allowing an attacker to bypass private IP blocklists by passing a bracketed IPv6 URL.
**Prevention:** Always explicitly strip `[` and `]` brackets from `URL.hostname` using `.replace(/^\[|\]$/g, "")` before applying allowlist/denylist string matching to prevent bypasses.

## 2024-XX-XX - Host Header Injection / XSS bypass in publicUrl
**Vulnerability:** Host Header Injection & Open Redirect / XSS bypass
**Learning:** `new URL(pathOrUrl, baseUrl)` permits the first argument to be an absolute URL which completely overrides the base. Even if `pathOrUrl` seems to be intended as a relative path, an attacker can supply an absolute URL (`https://evil.com` or `javascript:alert(1)`) to take full control of the generated URL. Additionally, `x-forwarded-host` can be spoofed in environments lacking strict reverse proxy sanitization.
**Prevention:** 1) Prefer securely injected environment variables (e.g. `NEXT_PUBLIC_SITE_URL`) over user-controlled headers for determining base URL. 2) Always enforce that the origin of the generated URL strictly matches the base origin (`url.origin === baseUrl.origin`), falling back to a safe default.
