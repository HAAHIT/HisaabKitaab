## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2025-02-24 - SSRF Bypass via IPv6 Bracket Preservation in URL.hostname
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass in Asset Proxy
**Learning:** In Node.js (and standard WHATWG URL parsing), `URL.hostname` preserves the square brackets around IPv6 addresses (e.g., `[::1]`). If you check the string directly against `::1` without stripping the brackets first, it will fail to match, allowing an attacker to bypass private IP blocklists by passing a bracketed IPv6 URL.
**Prevention:** Always explicitly strip `[` and `]` brackets from `URL.hostname` using `.replace(/^\[|\]$/g, "")` before applying allowlist/denylist string matching to prevent bypasses.

## 2024-05-24 - SSRF Filter Bypass via IPv4-Mapped IPv6 Hex Formatting
**Vulnerability:** The application's Server-Side Request Forgery (SSRF) defense failed to block requests targeting local resources if the attacker supplied an IPv4-mapped IPv6 address (e.g., \`http://[::ffff:127.0.0.1]/\`). Additionally, legitimate subdomains starting with an IP segment (e.g., \`10.example.com\`) were incorrectly blocked.
**Learning:** Node.js v22's \`URL\` parser automatically normalizes IPv4-mapped IPv6 loopbacks into a hexadecimal format (e.g., \`[::ffff:7f00:1]\`). The previous regex strictly expected a standard dot-decimal IPv4 representation at the end of the string, allowing the hex format to bypass the filter entirely. Furthermore, using string operations like \`startsWith("10.")\` on hostnames without first verifying they are IP addresses leads to false positives.
**Prevention:** Always rely on standard library utilities (like \`net.isIPv4\` or \`net.isIPv6\`) to confirm an input is an IP literal before applying blocklist prefix checks. Ensure SSRF regex filters account for hex-encoded segments in mapped IPv6 addresses (e.g., \`7f00\`, \`0a00\`), or better yet, resolve domains and validate the resulting IPs when possible.
