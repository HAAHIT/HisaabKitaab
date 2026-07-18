## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2025-02-24 - SSRF Bypass via IPv6 Bracket Preservation in URL.hostname
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass in Asset Proxy
**Learning:** In Node.js (and standard WHATWG URL parsing), `URL.hostname` preserves the square brackets around IPv6 addresses (e.g., `[::1]`). If you check the string directly against `::1` without stripping the brackets first, it will fail to match, allowing an attacker to bypass private IP blocklists by passing a bracketed IPv6 URL.
**Prevention:** Always explicitly strip `[` and `]` brackets from `URL.hostname` using `.replace(/^\[|\]$/g, "")` before applying allowlist/denylist string matching to prevent bypasses.
## 2025-02-24 - SSRF False Positives and IPv4-Mapped Hex Normalization
**Vulnerability:** SSRF False Positives and Bypass via Hex-encoded IPv6
**Learning:** Checking prefixes like `startsWith("10.")` without validating if the host is an IP using `net.isIPv4` blocks valid domains like `10.example.com`. Furthermore, Node.js normalizes IPv4-mapped IPv6 addresses into a hex format (e.g., `::ffff:7f00:1`), bypassing regexes that only look for dot-decimal IP formats.
**Prevention:** Always verify a host is a valid IP address using `net.isIPv4` or `net.isIPv6` before applying string matching blocklists, and decode hex segments for IPv4-mapped IPv6 addresses to prevent bypasses.
