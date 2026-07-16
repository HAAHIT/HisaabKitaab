## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2025-02-24 - SSRF Bypass via IPv6 Bracket Preservation in URL.hostname
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass in Asset Proxy
**Learning:** In Node.js (and standard WHATWG URL parsing), `URL.hostname` preserves the square brackets around IPv6 addresses (e.g., `[::1]`). If you check the string directly against `::1` without stripping the brackets first, it will fail to match, allowing an attacker to bypass private IP blocklists by passing a bracketed IPv6 URL.
**Prevention:** Always explicitly strip `[` and `]` brackets from `URL.hostname` using `.replace(/^\[|\]$/g, "")` before applying allowlist/denylist string matching to prevent bypasses.

## 2024-07-16 - [Node 22+ URL constructor normalizes mapped IPs]
**Vulnerability:** Node 22+ normalizes IPv4-mapped IPv6 addresses (e.g. `http://[::ffff:127.0.0.1]`) into hex format (`::ffff:7f00:1`), causing string-based proxy filters to miss private IPs.
**Learning:** URL constructors update standard formatting. Hex format checks and `node:net` validations are necessary for accurate filtering.
**Prevention:** Always combine `net.isIPv4` or `net.isIPv6` with hex decoding specifically designed for IPv4-mapped addresses when implementing IP blocklists.
