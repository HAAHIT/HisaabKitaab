## 2024-XX-XX - Open Redirect via Forward-Backslash Path Normalization
**Vulnerability:** Open Redirect
**Learning:** Browsers and URL parsers normalize paths starting with `/\` (slash-backslash) into `//` (protocol-relative). Checking only for `//` is insufficient.
**Prevention:** Explicitly block paths starting with `/\` when validating relative redirect URLs.

## 2024-XX-XX - SSRF via Localhost/Unspecified IP Address Normalization
**Vulnerability:** Server-Side Request Forgery (SSRF)
**Learning:** Checking against exact strings like `"127.0.0.1"` or `"localhost"` is insufficient for SSRF protection because URL parsers resolve bypass IP representations such as `0.0.0.0`, `127.1` (which resolves to `127.0.0.1`), and IPv6 equivalents (`[::1]`, `[::]`) natively.
**Prevention:** Block the entire `127.0.0.0/8` and `0.0.0.0/8` network blocks via prefix checks (e.g., `host.startsWith("127.") || host.startsWith("0.")`), and explicitly include IPv6 unspecified and loopback representations in exact match checks.
