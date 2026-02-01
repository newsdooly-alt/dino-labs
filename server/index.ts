import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

// Start Python yfinance service
let pythonProcess: ChildProcess | null = null;
let isShuttingDown = false;

async function checkPort5001(): Promise<boolean> {
  try {
    const response = await fetch("http://localhost:5001/health", {
      signal: AbortSignal.timeout(1000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function startPythonService() {
  // Check if already running (avoid duplicate spawns)
  if (await checkPort5001()) {
    console.log("[yfinance] Python service already running on port 5001");
    return;
  }
  
  // In production (bundled), look for python script relative to dist folder
  // In development, use process.cwd()
  const isProduction = process.env.NODE_ENV === "production";
  const currentFilePath = fileURLToPath(import.meta.url);
  const baseDir = isProduction 
    ? path.dirname(currentFilePath)
    : process.cwd();
  
  // Try multiple possible paths
  const possiblePaths = [
    path.join(baseDir, "..", "server", "python_stock_service.py"),  // production: dist/../server
    path.join(baseDir, "server", "python_stock_service.py"),        // development
    path.join(process.cwd(), "server", "python_stock_service.py"),  // fallback to cwd
  ];
  
  let pythonScript = "";
  for (const p of possiblePaths) {
    try {
      const fs = await import("fs");
      if (fs.existsSync(p)) {
        pythonScript = p;
        break;
      }
    } catch {
      continue;
    }
  }
  
  if (!pythonScript) {
    pythonScript = path.join(process.cwd(), "server", "python_stock_service.py");
    console.log("[yfinance] Warning: Could not verify Python script path, using:", pythonScript);
  }
  
  console.log("[yfinance] Starting Python stock service from:", pythonScript);
  
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
    if (!isShuttingDown) {
      console.log(`[yfinance] Python service exited with code ${code}`);
      // Restart after 2 seconds if it crashes (only if not shutting down)
      if (code !== 0) {
        setTimeout(startPythonService, 2000);
      }
    }
  });
}

// Cleanup on exit
function cleanupPython() {
  isShuttingDown = true;
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
}

process.on("exit", cleanupPython);
process.on("SIGINT", () => {
  cleanupPython();
  process.exit();
});
process.on("SIGTERM", () => {
  cleanupPython();
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
