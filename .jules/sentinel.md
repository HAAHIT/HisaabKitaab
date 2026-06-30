## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2025-02-24 - SSRF Bypass via IPv6 Bracket Preservation in URL.hostname
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass in Asset Proxy
**Learning:** In Node.js (and standard WHATWG URL parsing), `URL.hostname` preserves the square brackets around IPv6 addresses (e.g., `[::1]`). If you check the string directly against `::1` without stripping the brackets first, it will fail to match, allowing an attacker to bypass private IP blocklists by passing a bracketed IPv6 URL.
**Prevention:** Always explicitly strip `[` and `]` brackets from `URL.hostname` using `.replace(/^\[|\]$/g, "")` before applying allowlist/denylist string matching to prevent bypasses.

## 2024-06-30 - Host Header Injection in Password Reset and Absolute URLs
**Vulnerability:** Host Header Injection resulting in malicious link generation.
**Learning:** Depending entirely on unverified incoming request headers (like `x-forwarded-host` or `host`) to build absolute URLs exposes the application to Host Header Injection. An attacker can set a malicious `x-forwarded-host` header during a password reset request, causing the server to generate a reset link pointing to the attacker's server, hijacking the token if the user clicks it.
**Prevention:** Always prioritize securely configured environment variables (like `process.env.NEXT_PUBLIC_SITE_URL`) to build absolute URLs, using the incoming request headers only as a fallback if the environment variable is not defined.
