## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2024-06-04 - SSRF Bypass via Node.js IPv6 URL Parsing
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass.
**Learning:** Node.js `URL.hostname` preserves surrounding brackets for IPv6 addresses (e.g., `[::1]`). If security validation logic checks the raw `URL.hostname` against plain IPv6 strings (like `::1`), attackers can bypass the checks using bracketed hostnames.
**Prevention:** Always explicitly strip `[` and `]` brackets from `URL.hostname` or use a dedicated network library/IP parsing utility before applying allowlist/denylist validation rules for IPs.
