// The security headers on every answer, in one place: the Worker sets them
// on the API's answers (server/http.ts), and the pages build writes them
// into the static assets' _headers file (scripts/build-pages.ts), so the
// two can't drift. No imports, so a Bun script can read it as it is.

// Only the app's own origin, for every kind of content. fflate inflates a
// large zip entry in a worker made from a blob: URL, which the page itself
// creates (app-notes/unzip-in-browser.md, Workers and CSP).
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** Every answer's security headers. HSTS is always sent: a browser ignores it over plain http, as on localhost. */
export const SECURITY_HEADERS: Record<string, string> = {
  "content-security-policy": CONTENT_SECURITY_POLICY,
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "same-origin",
  "cross-origin-opener-policy": "same-origin",
  "strict-transport-security": "max-age=31536000",
};
