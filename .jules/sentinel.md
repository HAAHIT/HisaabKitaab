## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2025-02-24 - SSRF Bypass via IPv6 Bracket Preservation in URL.hostname
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass in Asset Proxy
**Learning:** In Node.js (and standard WHATWG URL parsing), `URL.hostname` preserves the square brackets around IPv6 addresses (e.g., `[::1]`). If you check the string directly against `::1` without stripping the brackets first, it will fail to match, allowing an attacker to bypass private IP blocklists by passing a bracketed IPv6 URL.
**Prevention:** Always explicitly strip `[` and `]` brackets from `URL.hostname` using `.replace(/^\[|\]$/g, "")` before applying allowlist/denylist string matching to prevent bypasses.
## 2025-02-27 - Fix SSRF bypass via IPv4-mapped IPv6 hex encoding and missing IP format verification
**Vulnerability:** The SSRF protection mechanism had two issues. First, it checked for `isPrivateIPv4` using string prefixes (e.g., `startsWith("10.")`) without verifying if the host is a valid IPv4 address first, inadvertently blocking legitimate domains like `10.example.com`. Second, it failed to block hex-encoded IPv4-mapped IPv6 addresses like `[::ffff:7f00:1]` (which is what `URL.hostname` normalizes `[::ffff:127.0.0.1]` to in Node.js 22+).
**Learning:** `URL.hostname` normalization in Node.js 22+ uses hex encoding for IPv4-mapped IPv6 addresses. If SSRF defenses rely solely on matching standard dot-decimal base-10 strings (like `127.0.0.1`), they can be bypassed since `[::ffff:127.0.0.1]` normalizes to `[::ffff:7f00:1]`. Additionally, string checks for IP prefixes must only be applied after validating that the string is indeed an IP address using `net.isIPv4(host)`.
**Prevention:** Always convert hex segments of IPv4-mapped IPv6 addresses back to standard dot-decimal strings before validating them against a list of private IPs. Furthermore, always verify `net.isIPv4(host)` before applying IPv4-specific prefix string matching to prevent false positives and block legitimate domains.
