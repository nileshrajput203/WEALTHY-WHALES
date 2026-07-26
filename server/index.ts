import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// ── Security headers — protect source, prevent framing & scraping ──────────
app.use((req: Request, res: Response, next: NextFunction) => {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  // Prevent MIME sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // XSS protection (legacy browsers)
  res.setHeader("X-XSS-Protection", "1; mode=block");
  // Referrer control
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Remove server fingerprint
  res.removeHeader("X-Powered-By");
  // Permissions policy — restrict sensitive APIs
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  // Content-Security-Policy — restrict where resources can be fetched from
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        // TradingView widget scripts + Google OAuth
        "script-src 'self' 'unsafe-inline' https://accounts.google.com https://s3.tradingview.com https://s.tradingview.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://generativelanguage.googleapis.com https://api.groq.com https://openrouter.ai https://query1.finance.yahoo.com https://finance.yahoo.com wss:",
        // TradingView chart iframes
        "frame-src 'self' https://s.tradingview.com https://www.tradingview.com",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "object-src 'none'",
      ].join("; ")
    );
  }
  next();
});

// ── robots.txt — block scrapers from crawling API routes ───────────────────
app.get("/robots.txt", (_req: Request, res: Response) => {
  res.type("text/plain").send(
    "User-agent: *\nDisallow: /api/\nDisallow: /admin\nAllow: /\n"
  );
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Lightweight request logger — does NOT buffer response bodies to avoid memory leaks
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: false,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
