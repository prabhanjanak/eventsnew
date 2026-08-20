import app from "./app";
import { logger } from "./lib/logger";
import { ensureSuperAdmin } from "./lib/superadmin";
import { type Server } from "http";

// ── Environment validation ─────────────────────────────────────────────────────
const rawPort = process.env["PORT"];
if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Guard against missing or default SESSION_SECRET in production
const secret = process.env["SESSION_SECRET"] ?? "";
const WEAK_SECRETS = ["vision2020_secret_key", "vision2020_local_secret_key", "secret", "changeme", ""];
if (process.env.NODE_ENV === "production" && WEAK_SECRETS.includes(secret)) {
  logger.error("FATAL: SESSION_SECRET is missing or is a default placeholder. Set a strong secret in .env before running in production.");
  process.exit(1);
}

// ── Request timeout middleware (30 seconds) ────────────────────────────────────
// Attach before starting server so it covers every route
app.use((req, res, next) => {
  // Skip timeout for long-running sync/export operations
  const skipPaths = ["/api/participants/sync", "/api/participants/export", "/api/participants/batch-qr"];
  if (skipPaths.some(p => req.path.startsWith(p))) return next();

  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(503).json({ error: "Request timed out. The server is under load. Please try again." });
    }
  }, 30_000);

  // Clear timeout when response is sent
  res.on("finish", () => clearTimeout(timeout));
  res.on("close", () => clearTimeout(timeout));
  next();
});

// ── Start server ───────────────────────────────────────────────────────────────
let server: Server;

server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
  ensureSuperAdmin();
});

server.on("error", (err) => {
  logger.error({ err }, "Server error");
  process.exit(1);
});

// ── Graceful shutdown ──────────────────────────────────────────────────────────
// Allows in-flight requests to finish before the process exits (PM2 / Docker restart)
function gracefulShutdown(signal: string) {
  logger.info({ signal }, "Shutdown signal received, closing server gracefully...");
  server.close((err) => {
    if (err) {
      logger.error({ err }, "Error during graceful shutdown");
      process.exit(1);
    }
    logger.info("All connections closed. Process exiting cleanly.");
    process.exit(0);
  });

  // Force exit after 10 seconds if connections don't drain
  setTimeout(() => {
    logger.warn("Graceful shutdown timeout (10s). Forcing exit.");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));

// ── Unhandled errors ───────────────────────────────────────────────────────────
process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled Rejection at Promise");
  // Do NOT exit — a rejected DB query should not kill the server
});

process.on("uncaughtException", (err, origin) => {
  logger.error({ err, origin }, "Uncaught Exception thrown — forcing process restart");
  // Exit so PM2 / systemd can restart cleanly. Running in a broken state is worse.
  process.exit(1);
});
