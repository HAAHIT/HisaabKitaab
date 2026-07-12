## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2025-02-24 - SSRF Bypass via IPv6 Bracket Preservation in URL.hostname
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass in Asset Proxy
**Learning:** In Node.js (and standard WHATWG URL parsing), `URL.hostname` preserves the square brackets around IPv6 addresses (e.g., `[::1]`). If you check the string directly against `::1` without stripping the brackets first, it will fail to match, allowing an attacker to bypass private IP blocklists by passing a bracketed IPv6 URL.
**Prevention:** Always explicitly strip `[` and `]` brackets from `URL.hostname` using `.replace(/^\[|\]$/g, "")` before applying allowlist/denylist string matching to prevent bypasses.

## 2024-05-18 - Fix Open Redirect and XSS in `publicUrl` Helper
**Vulnerability:** The `publicUrl` helper in `src/lib/public-url.ts` returned a URL object parsed directly from user input alongside the base URL. If the user input was an absolute URL like `javascript:alert(1)` or `https://evil.com`, `new URL()` would ignore the base URL entirely, causing potential XSS and Open Redirect vulnerabilities across the application (e.g. `returnTo` redirect after language selection).
**Learning:** `new URL(path, base)` completely disregards the `base` if `path` is an absolute URL. Checking the prefix with simple string checks (like blocking `//` or `/\`) is insufficient because opaque URLs (like `javascript:`) or explicitly valid protocol URLs (like `https://`) bypass them.
**Prevention:** Always explicitly check if the parsed `url.origin` strictly matches `baseOrigin`. If it does not, fallback to a safe default path (like `/`) on the base origin.
