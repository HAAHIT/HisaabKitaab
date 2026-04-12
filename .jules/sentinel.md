## 2026-04-12 - Open Redirect Bypass Prevention
**Vulnerability:** The application's `getSafeReturnPath` function was vulnerable to an open redirect bypass using `/\malicious.com`, which browsers normalize to `//malicious.com` (protocol-relative URL).
**Learning:** URL normalization behaviors in the URL API and browsers will often treat a forward slash followed by a backslash (`/\`) the same as `//`.
**Prevention:** When enforcing relative URLs, explicitly block strings starting with `/\` alongside `//` or use strict URL parsing libraries.
