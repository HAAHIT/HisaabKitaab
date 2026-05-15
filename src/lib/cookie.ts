// __Host- prefix requirements: Secure, path=/, no Domain attribute.
// We apply it only in production because __Host- cookies require HTTPS
// and browsers silently reject them over plain HTTP (dev).
export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-hisaabkitaab-session"
    : "hisaabkitaab-session";
