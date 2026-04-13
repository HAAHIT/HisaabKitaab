## 2026-04-13 - [Open Redirect Bypass via URL Normalization]
**Vulnerability:** Open redirect allowing attackers to bypass `startsWith("//")` check by using `/\` which gets normalized to `//` by browsers.
**Learning:** Checking for `//` is not sufficient to prevent protocol-relative redirects because browsers and Next.js URL parsing normalize mixed slashes (e.g., `/\malicious.com` -> `//malicious.com`).
**Prevention:** Always validate relative paths by explicitly checking and blocking `/\` as well as `//`.
