## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2025-02-24 - SSRF Bypass via IPv6 Bracket Preservation in URL.hostname
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass in Asset Proxy
**Learning:** In Node.js (and standard WHATWG URL parsing), `URL.hostname` preserves the square brackets around IPv6 addresses (e.g., `[::1]`). If you check the string directly against `::1` without stripping the brackets first, it will fail to match, allowing an attacker to bypass private IP blocklists by passing a bracketed IPv6 URL.
**Prevention:** Always explicitly strip `[` and `]` brackets from `URL.hostname` using `.replace(/^\[|\]$/g, "")` before applying allowlist/denylist string matching to prevent bypasses.

## 2025-02-24 - Host Header Injection & Open Redirect via URL Parsing
**Vulnerability:** Host Header Injection leading to poisoned absolute URLs, and Open Redirect/XSS via unvalidated `new URL()` resolution.
**Learning:** Depending on `x-forwarded-host` without a strict fallback to a known environment variable allows attackers to generate malicious password reset or redirect links. Furthermore, `new URL(pathOrUrl, base)` natively resolves protocol-relative URLs (`//evil.com`) and data URIs (`javascript:`) into absolute URLs that bypass simple string prefix checks.
**Prevention:** 1. Prioritize environment variables like `NEXT_PUBLIC_SITE_URL` for absolute URL construction over user-controlled headers. 2. Always strictly validate the `origin` property of the resulting URL object (e.g. `resolved.origin === base.origin` and `resolved.origin !== "null"`) instead of checking the input string for prefixes.
