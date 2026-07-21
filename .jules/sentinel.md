## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2025-02-24 - SSRF Bypass via IPv6 Bracket Preservation in URL.hostname
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass in Asset Proxy
**Learning:** In Node.js (and standard WHATWG URL parsing), `URL.hostname` preserves the square brackets around IPv6 addresses (e.g., `[::1]`). If you check the string directly against `::1` without stripping the brackets first, it will fail to match, allowing an attacker to bypass private IP blocklists by passing a bracketed IPv6 URL.
**Prevention:** Always explicitly strip `[` and `]` brackets from `URL.hostname` using `.replace(/^\[|\]$/g, "")` before applying allowlist/denylist string matching to prevent bypasses.

## 2024-05-24 - URL Constructor Open Redirect/XSS
**Vulnerability:** Open Redirect and potential XSS via `javascript:` URIs in `publicUrl` helper.
**Learning:** `new URL(pathOrUrl, baseUrl)` blindly accepts absolute URLs (like `https://evil.com` or `javascript:alert(1)`) in the `pathOrUrl` argument, ignoring the `baseUrl` entirely. Simple string prefix checks (`startsWith("/")`) are often bypassed or insufficient.
**Prevention:** Always validate the `origin` of the resulting `URL` object against the expected base origin. Ensure `url.origin !== "null"` (blocks `javascript:` and `data:`) and `url.origin === baseUrl.origin`.
