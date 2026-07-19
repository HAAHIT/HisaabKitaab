## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2025-02-24 - SSRF Bypass via IPv6 Bracket Preservation in URL.hostname
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass in Asset Proxy
**Learning:** In Node.js (and standard WHATWG URL parsing), `URL.hostname` preserves the square brackets around IPv6 addresses (e.g., `[::1]`). If you check the string directly against `::1` without stripping the brackets first, it will fail to match, allowing an attacker to bypass private IP blocklists by passing a bracketed IPv6 URL.
**Prevention:** Always explicitly strip `[` and `]` brackets from `URL.hostname` using `.replace(/^\[|\]$/g, "")` before applying allowlist/denylist string matching to prevent bypasses.
## 2026-07-19 - SSRF Bypass via Node.js 22 IPv4-mapped IPv6 normalization
**Vulnerability:** In Node.js 22+, `URL.hostname` normalizes IPv4-mapped IPv6 addresses (e.g., `[::ffff:127.0.0.1]`) into hex-formatted addresses (e.g., `[::ffff:7f00:1]`). The custom `isPrivateIPv6` validator used string matching (`host.match(/^(?:::ffff:|::)([0-9.]+)$/)`) that expected dot-decimal format, thus failing to identify the hex-formatted address as an IPv4-mapped IPv6 address and inadvertently allowing SSRF against private addresses.
**Learning:** `URL.hostname` behaves differently across Node.js versions. Relying strictly on dot-decimal representations in regex for IPv4-mapped IPv6 addresses is dangerous and leads to a bypass if the standard hex normalization kicks in.
**Prevention:** Always validate IPv4-mapped IPv6 addresses by parsing potential hex segments and decoding them back to dot-decimal formats, or directly use built-in, trusted IP libraries (like `ip-address` or `is-ip`) that handle these platform-specific edge cases natively, rather than custom regex checking on `URL.hostname` outputs.
