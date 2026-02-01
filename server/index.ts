import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { spawn, ChildProcess } from "child_process";
import path from "path";

// Start Python yfinance service
let pythonProcess: ChildProcess | null = null;

function startPythonService() {
  const pythonScript = path.join(process.cwd(), "server", "python_stock_service.py");
  console.log("[yfinance] Starting Python stock service...");
  
  pythonProcess = spawn("python", [pythonScript], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  pythonProcess.stdout?.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(`[yfinance] ${msg}`);
  });

  pythonProcess.stderr?.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) console.error(`[yfinance] ${msg}`);
  });

  pythonProcess.on("close", (code) => {
    console.log(`[yfinance] Python service exited with code ${code}`);
    // Restart after 2 seconds if it crashes
    if (code !== 0) {
      setTimeout(startPythonService, 2000);
    }
  });
}

// Cleanup on exit
process.on("exit", () => {
  if (pythonProcess) pythonProcess.kill();
});
process.on("SIGINT", () => {
  if (pythonProcess) pythonProcess.kill();
  process.exit();
});

// Start the Python service
startPythonService();

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
