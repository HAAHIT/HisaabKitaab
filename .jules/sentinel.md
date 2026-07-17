## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2025-02-24 - SSRF Bypass via IPv6 Bracket Preservation in URL.hostname
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass in Asset Proxy
**Learning:** In Node.js (and standard WHATWG URL parsing), `URL.hostname` preserves the square brackets around IPv6 addresses (e.g., `[::1]`). If you check the string directly against `::1` without stripping the brackets first, it will fail to match, allowing an attacker to bypass private IP blocklists by passing a bracketed IPv6 URL.
**Prevention:** Always explicitly strip `[` and `]` brackets from `URL.hostname` using `.replace(/^\[|\]$/g, "")` before applying allowlist/denylist string matching to prevent bypasses.

## 2026-07-17 - Host Header Injection & Open Redirect via URL Parsing
**Vulnerability:** The `getPublicBaseUrl` function trusted the `x-forwarded-host` header to resolve the base URL without validating against a configured source of truth. Additionally, the `publicUrl` utility used `new URL(pathOrUrl, baseUrl)`, which inherently allows open redirection and XSS (via `javascript:` paths) because absolute URLs override the base parameter entirely.
**Learning:** Even internal utility functions for URL resolution can introduce severe vulnerabilities if they blindly trust headers or fail to validate origin matching when using the native `URL` constructor.
**Prevention:** Always prioritize securely injected environment variables (e.g., `NEXT_PUBLIC_SITE_URL`) over request headers for base URLs. When resolving user-supplied relative paths, rigorously enforce origin boundary constraints (`resultUrl.origin === baseUrl.origin`) and reject opaque origins like `"null"` (which catch `javascript:` and `data:` schemes).
