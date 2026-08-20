import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// ── IP Helpers ─────────────────────────────────────────────────────────────────

/** Check if an IP (already normalised by ipKeyGenerator) is private/LAN */
function isPrivateIp(ip: string | undefined): boolean {
  if (!ip || typeof ip !== "string") return false;
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "unknown" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    // IPv6-mapped private addresses
    ip.startsWith("::ffff:192.168.") ||
    ip.startsWith("::ffff:10.")
  );
}

/** Get normalised client IP from request */
function getClientIp(req: any): string {
  const rawIp = req.ip || "127.0.0.1";
  try {
    return ipKeyGenerator(rawIp);
  } catch (e) {
    return rawIp;
  }
}

/** Use express-rate-limit's own IPv6-safe key generator, then normalise */
function makeKeyGenerator() {
  return (req: any): string => {
    return getClientIp(req);
  };
}

function makeSkip() {
  return (req: any): boolean => {
    return isPrivateIp(getClientIp(req));
  };
}

// ── Rate Limiters ──────────────────────────────────────────────────────────────

/**
 * OTP send limiter — 5 requests per 10 minutes per IP.
 * Protects against OTP spam / flooding WhatsApp & Email delivery.
 * LAN/private IPs are exempted (venue staff devices).
 */
export const otpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many OTP requests from this IP. Please wait 10 minutes before trying again." },
  keyGenerator: makeKeyGenerator(),
  skip: makeSkip(),
});

/**
 * OTP verify limiter — 8 attempts per 5 minutes per IP.
 * Works together with per-participant lockout in auth.ts.
 * LAN/private IPs are exempted.
 */
export const otpVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many OTP verification attempts. Please wait 5 minutes." },
  keyGenerator: makeKeyGenerator(),
  skip: makeSkip(),
});

/**
 * Global API limiter — 300 requests per minute per IP.
 * Prevents scraping and DoS floods on all /api/* routes.
 * LAN/private IPs are exempted.
 */
export const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP. Please slow down." },
  keyGenerator: makeKeyGenerator(),
  skip: makeSkip(),
});
