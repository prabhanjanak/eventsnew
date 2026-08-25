import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { requestCounterMiddleware } from "./routes/metrics";
import { globalApiLimiter } from "./middlewares/rateLimiter";
import path from "path";
import fs from "fs";

const app: Express = express();

// ── Trust nginx/reverse-proxy forwarded headers (for real client IPs) ──────────
// Only trust the immediate upstream hop (nginx), not arbitrary X-Forwarded-For chains
app.set("trust proxy", 1);

// ── Security Headers (Helmet) ───────────────────────────────────────────────────
// Disable internal CSP and HSTS to allow smooth operation behind Nginx reverse proxy
// and allow clean internal IP HTTP access without browser protocol errors.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    originAgentCluster: false,
    hsts: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

// ── CORS — fully permissive origin ──────────────────────────────────────────────
app.use(
  cors({
    origin: true, // Reflect request origin to allow any client connection
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400, // Cache preflight for 24h
  })
);

// ── Compression (gzip) ──────────────────────────────────────────────────────────
app.use(compression());

// ── Structured logging ──────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── Body Parsers — enforce size limits to prevent payload DoS ──────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Traffic monitoring ─────────────────────────────────────────────────────────
app.use(requestCounterMiddleware);

// ── Global rate limiter (300 req/min per IP; LAN exempted) ─────────────────────
app.use("/api", globalApiLimiter);

// ── Serve uploaded files with long-lived cache headers ──────────────────────────
const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use(
  "/api/uploads",
  express.static(uploadsDir, {
    maxAge: "1d",
    etag: true,
    lastModified: true,
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    },
  })
);
app.use(
  "/uploads",
  express.static(uploadsDir, {
    maxAge: "1d",
    etag: true,
    lastModified: true,
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    },
  })
);

// ── Public /api/routemap.pdf endpoint ────────────────────────────────────────
// Route is under /api so nginx proxies it to Node (no nginx config needed)
// Accessible at: https://events.sankaraeye.in/api/routemap.pdf
// Also redirects from /routemap.pdf for convenience
app.get("/routemap.pdf", (_req, res) => {
  res.redirect(301, "/api/routemap.pdf");
});


// ── API routes ─────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── SPA fallback — serve frontend in production ────────────────────────────────
const candidateDirs = [
  path.resolve(process.cwd(), "artifacts/events/dist/public"),
  path.resolve(process.cwd(), "../events/dist/public"),
  path.resolve(process.cwd(), "dist/public"),
  path.resolve(process.cwd(), "../vision2020/dist/public"),
  path.resolve(__dirname, "../../events/dist/public"),
  path.resolve(__dirname, "../../../artifacts/events/dist/public"),
];
const frontendPublicDir = candidateDirs.find((dir) => fs.existsSync(dir));
if (frontendPublicDir) {
  app.use(express.static(frontendPublicDir));
  app.get(/^(?!\/api).*$/, (_req, res) => {
    res.sendFile(path.join(frontendPublicDir, "index.html"));
  });
}

// ── Global error handler ───────────────────────────────────────────────────────
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  // CORS errors
  if (err.message?.startsWith("CORS:")) {
    res.status(403).json({ error: "Forbidden: " + err.message });
    return;
  }
  // Multer file type / size errors
  if (err.message?.includes("Only PPTX") || err.message?.includes("Only JPG") || err.message?.includes("only")) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (err.message?.includes("File too large")) {
    res.status(400).json({ error: "File too large (max 20 MB)" });
    return;
  }
  // JSON body too large
  if (err.type === "entity.too.large") {
    res.status(413).json({ error: "Request body too large (max 1 MB)" });
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
