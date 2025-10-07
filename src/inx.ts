import dotenv from "dotenv";
import path from "path";

// Load .env files before any other imports
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env.customer"), override: true });

import express, { Request, Response, NextFunction, Application, RequestHandler } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUI from "swagger-ui-express";
import { createServer } from "http";
import morgan from "morgan";
import winston from "winston";
import { initRedis, shutdownRedis, testRedisStability, isRedisError, getRedisClient } from "./config/redis";
import { ENV } from "./config/env";
import { rootRoutes } from "./routes/root";
import { errorHandler } from "./middlewares/errors";
import { initWebSocket } from "./websocket";
import fs from "fs";
// import { startNotificationWorker, stopNotificationWorker } from "./workers/walletnotification";

// Define the expected type for the PostGIS query result
interface PostgisQueryResult {
  postgis_installed: boolean;
}

// Initialize Winston logger with exception handlers
const logger = winston.createLogger({
  level: ENV.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(path.resolve(ENV.LOG_DIR || "./logs"), "customer-error.log"),
      level: "error",
    }),
    new winston.transports.File({
      filename: path.join(path.resolve(ENV.LOG_DIR || "./logs"), "customer-combined.log"),
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(path.resolve(ENV.LOG_DIR || "./logs"), "exceptions.log"),
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
  exitOnError: false, // Prevent process exit on unhandled errors
});

if (ENV.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

// Log critical configurations
logger.info("Starting Customer Service...");
logger.info("Environment variables loaded", {
  nodeEnv: ENV.NODE_ENV,
  apiPort: ENV.API_PORT,
  apiHost: ENV.API_HOST,
  corsOrigins: ENV.CORS_ORIGINS.join(", "),
  redisUrl: ENV.REDIS_URL.replace(/:.*@/, ":<redacted>@"),
  webhookSecret: ENV.WEBHOOK_SECRET ? "<redacted>" : undefined,
  flutterwaveWebhookSecret: ENV.FLUTTERWAVE_WEBHOOK_SECRET ? "<redacted>" : undefined,
  service: "customer-service",
});

// Initialize Express app and HTTP server
const app: Application = express();
const server = createServer(app);

// Enable trust proxy for ngrok or other proxies
app.set("trust proxy", 1);

// Flag to indicate server readiness
let isServerReady = false;

// Middleware to block requests until server is ready
const serverReadyMiddleware: RequestHandler = (req, res, next) => {
  if (
    !isServerReady &&
    ![
      "/health",
      "/api/payments/callback",
      "/flutterwave/webhook",
      "/api-docs",
      "/api-docs/swagger.json",
    ].includes(req.path)
  ) {
    logger.warn(`Server not ready, rejecting request to ${req.path}`);
    res.status(503).json({
      success: false,
      message: "Service is starting, please try again later",
    });
    return;
  }
  next();
};

app.use(serverReadyMiddleware);

// Initialize WebSocket
try {
  logger.debug("Initializing WebSocket");
  initWebSocket(server);
  logger.debug("WebSocket initialized successfully");
} catch (error: unknown) {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error(`Failed to initialize WebSocket: ${err.message}`, { stack: err.stack });
  process.exit(1);
}

// Initialize Prisma client
export const prismaClient = new PrismaClient({
  log: ["error", "warn"],
  datasources: {
    db: {
      url: ENV.POSTGRES_URL,
    },
  },
});

// Apply express.raw() for webhook routes before any JSON parsing
app.use("/flutterwave/webhook", express.raw({ type: "application/json" }));

// Apply express.json() for other routes, skipping webhook routes
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.originalUrl.startsWith("/flutterwave/webhook")) {
    return next(); // Skip JSON parsing for webhook
  }
  return express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      (req as any).rawBody = buf; // Store raw body as Buffer for non-webhook routes
    },
  })(req, res, next);
});

app.use(express.urlencoded({ extended: true }));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: [
          "'self'",
          ENV.NODE_ENV === "production"
            ? "https://api.quicrefill.com"
            : ENV.API_GATEWAY_URL || "http://localhost:4000",
          ENV.NODE_ENV === "production"
            ? "wss://api.quicrefill.com"
            : `ws://${(ENV.API_GATEWAY_URL || "http://localhost:4000").split("://")[1] || "localhost:4000"}`,
        ],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  })
);

// Morgan logging
app.use(
  morgan("combined", {
    stream: {
      write: (message: string) => {
        logger.http(message.trim());
      },
    },
    skip: (req: Request) => req.method === "OPTIONS" || req.path === "/health",
  })
);

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => req.path === "/health",
});
app.use(limiter);

// CORS configuration
app.use(
  cors({
    origin: ENV.CORS_ORIGINS.length > 0
      ? ENV.CORS_ORIGINS
      : ENV.NODE_ENV === "production"
      ? "https://api.quicrefill.com"
      : "http://localhost:4000",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
    preflightContinue: false,
  })
);

// Remove unnecessary headers
app.use((req: Request, res: Response, next: NextFunction) => {
  res.removeHeader("Cross-Origin-Opener-Policy");
  res.removeHeader("X-Powered-By");
  next();
});

// Swagger configuration
let openapiSpecification: any;
try {
  logger.debug("Initializing Swagger specification");
  if (fs.existsSync("./swagger.json")) {
    logger.info("Loading static Swagger JSON from ./swagger.json");
    openapiSpecification = JSON.parse(fs.readFileSync("./swagger.json", "utf8"));
  } else {
    logger.info("Generating Swagger specification dynamically");
    const swaggerOptions: swaggerJSDoc.Options = {
      failOnErrors: true,
      definition: {
        openapi: "3.0.0",
        info: {
          title: "Quicrefill Customer Service API",
          version: "1.0.0",
          description: "API documentation for Quicrefill Customer Service, managing accounts and authentication",
          contact: { name: "Quicrefill Support", email: "support@quicrefill.com" },
        },
        servers: [
          {
            url: ENV.NODE_ENV === "production"
              ? "https://api.quicrefill.com/api/customer"
              : `${ENV.API_GATEWAY_URL || "http://localhost:4000"}/api/customer`,
            description: ENV.NODE_ENV === "production"
              ? "Production server via API Gateway"
              : "Development server",
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
      },
      apis: [
        "./src/routes/**/*.ts",
        "./src/controllers/**/*.ts",
        "./src/index.ts",
      ],
    };
    openapiSpecification = swaggerJSDoc(swaggerOptions);
    logger.info("Swagger specification generated successfully");
  }
} catch (error: unknown) {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error(`Failed to initialize Swagger specification: ${err.message}`, { stack: err.stack });
  openapiSpecification = { error: "Swagger initialization failed" };
}

// Swagger JSON endpoint
app.get("/api-docs/swagger.json", (req: Request, res: Response) => {
  if (openapiSpecification.error) {
    logger.error(`Serving Swagger JSON failed due to initialization error: ${openapiSpecification.error}`);
    res.status(500).json({
      success: false,
      message: "Failed to load Swagger specification",
      error: openapiSpecification.error,
    });
    return;
  }
  res.json(openapiSpecification);
});

// Swagger UI with auth
const protectApiDocs: RequestHandler = (req, res, next) => {
  if (req.path === "/api-docs/swagger.json") {
    logger.info("Skipping Basic Auth for /api-docs/swagger.json");
    return next();
  }

  const authHeader = req.headers.authorization;
  const validUsername = ENV.API_DOCS_USERNAME || "admin";
  const validPassword = ENV.API_DOCS_PASSWORD || "admin123";

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="API Docs"');
    res.status(401).json({ success: false, message: "Authentication required" });
    return;
  }

  const base64Credentials = authHeader.split(" ")[1];
  const credentials = Buffer.from(base64Credentials, "base64").toString("ascii");
  const [username, password] = credentials.split(":");

  if (username === validUsername && password === validPassword) {
    logger.info(`API documentation accessed by user: ${username}`);
    next();
    return;
  }

  res.setHeader("WWW-Authenticate", 'Basic realm="API Docs"');
  res.status(401).json({ success: false, message: "Invalid credentials" });
};

app.use(
  "/api-docs",
  protectApiDocs,
  swaggerUI.serve,
  swaggerUI.setup(openapiSpecification, {
    customSiteTitle: "Quicrefill Customer Service API Documentation",
    swaggerOptions: {
      schemes: ["http", "https"],
      url: ENV.NODE_ENV === "production"
        ? "https://api.quicrefill.com/api-docs/customer/swagger.json"
        : `${ENV.API_GATEWAY_URL || "http://localhost:4000"}/api-docs/customer/swagger.json`,
      validatorUrl: null,
      displayRequestDuration: true,
    },
  })
);

// Health check
app.get("/health", async (req: Request, res: Response) => {
  let redisStatus = "DOWN";
  let databaseStatus = "DOWN";
  let postgisStatus = "DOWN";
  let redisError: string | null = null;
  let databaseError: string | null = null;
  let postgisError: string | null = null;

  try {
    logger.debug("Starting Redis health check");
    const redis = await getRedisClient();
    const pingPromise = redis.ping();
    const pingResult = await Promise.race([
      pingPromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Redis ping timeout")), 2000)),
    ]);
    const isRedisConnected = pingResult === "PONG";
    const isRedisStable = await Promise.race([
      testRedisStability(3, 500),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Redis stability timeout")), 2000)),
    ]);
    redisStatus = isRedisConnected && isRedisStable ? "UP" : "DOWN";
    logger.info(`Redis health check: ${redisStatus}`, {
      isConnected: isRedisConnected,
      isStable: isRedisStable,
      url: ENV.REDIS_URL.replace(/:.*@/, ":<redacted>@"),
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    redisError = err.message;
    logger.error(`Redis health check failed: ${redisError}`, {
      stack: err.stack,
      code: isRedisError(error) ? error.code : undefined,
    });
  }

  try {
    logger.debug("Starting PostgreSQL health check");
    const queryPromise = prismaClient.$queryRaw`SELECT 1`;
    await Promise.race([
      queryPromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Database query timeout")), 2000)),
    ]);
    logger.info("PostgreSQL connection successful");
    databaseStatus = "UP";
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    databaseError = err.message;
    logger.error(`Database health check failed: ${databaseError}`, { stack: err.stack });
  }

  try {
    logger.debug("Starting PostGIS health check");
    const postgisCheck = await Promise.race([
      prismaClient.$queryRaw<PostgisQueryResult[]>`
        SELECT EXISTS (
          SELECT FROM pg_extension WHERE extname = 'postgis'
        ) AS postgis_installed;
      `,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("PostGIS query timeout")), 2000)),
    ]);
    postgisStatus = postgisCheck[0]?.postgis_installed ? "UP" : "DOWN";
    logger.info(`PostGIS health check: ${postgisStatus}`);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    postgisError = err.message;
    logger.warn(`PostGIS health check failed: ${postgisError}`, { stack: err.stack });
  }

  const isHealthy = databaseStatus === "UP";
  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    message: `Customer Service is ${isHealthy ? "running" : "unhealthy"}`,
    uptime: process.uptime(),
    timestamp: new Date(),
    gatewayUrl: ENV.NODE_ENV === "production"
      ? "https://api.quicrefill.com"
      : ENV.API_GATEWAY_URL || "http://localhost:4000",
    redisStatus,
    redisError,
    databaseStatus,
    databaseError,
    postgisStatus,
    postgisError,
    environment: ENV.NODE_ENV,
    version: "1.0.0",
  });
});

// Mount root routes
app.use("/", rootRoutes);

// Error handler
app.use(errorHandler);

// Initialize log directory
const initializeLogDir = () => {
  const logDir = path.resolve(ENV.LOG_DIR || "./logs");
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
      fs.chmodSync(logDir, 0o775);
      logger.info(`Log directory initialized at ${logDir}`);
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to initialize log directory: ${err.message}`, { stack: err.stack });
    throw err;
  }
};

// Start server with retries
const startServer = async () => {
  const maxRetries = 3;
  let attempt = 1;

  while (attempt <= maxRetries) {
    try {
      logger.debug(`Starting server attempt ${attempt}/${maxRetries}`);
      initializeLogDir();
      logger.debug("Log directory initialized");

      const redis = await getRedisClient();
      logger.info(`Redis client status`, {
        isOpen: redis.isOpen,
        isReady: redis.isReady,
        url: ENV.REDIS_URL.replace(/:.*@/, ":<redacted>@"),
      });

      await prismaClient.$connect();
      logger.info("Prisma client connected successfully");

      const isRedisStable = await testRedisStability(5, 1000);
      if (!isRedisStable) {
        throw new Error("Redis connection is unstable");
      }
      logger.debug("Redis stability test passed");

      isServerReady = true;
      logger.debug(`Starting server listen on http://${ENV.API_HOST}:${ENV.API_PORT}`);
      server.listen(ENV.API_PORT, ENV.API_HOST, () => {
        logger.info(`Customer Service running on http://${ENV.API_HOST}:${ENV.API_PORT}/api/customer`);
        logger.info(`WebSocket Server running on ws://${ENV.API_HOST}:${ENV.API_PORT}/ws`);
        logger.info(`Swagger UI available at http://${ENV.API_HOST}:${ENV.API_PORT}/api-docs`);
        logger.info(`Proxied via API Gateway at ${ENV.NODE_ENV === "production" ? "https://api.quicrefill.com/api-docs/customer" : `${ENV.API_GATEWAY_URL || "http://localhost:4000"}/api-docs/customer`}`);
        logger.info(`Using API Gateway at ${ENV.API_GATEWAY_URL || "http://localhost:4000"}`);
      });
      logger.debug("Server listen initiated");
      return;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Start server attempt ${attempt}/${maxRetries} failed: ${err.message}`, {
        stack: err.stack,
        code: isRedisError(error) ? error.code : undefined,
        rawError: JSON.stringify(error),
      });
      if (attempt === maxRetries) {
        logger.error(`Failed to start Customer Service after ${maxRetries} attempts`, { error: err });
        throw err;
      }
      attempt++;
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
};

// Main function to orchestrate startup
async function main() {
  try {
    logger.debug("Starting main function");
    await initRedis(10, 2000, true);
    logger.debug("Redis initialized successfully");
    await startServer();
    logger.debug("Server started successfully");
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Application startup failed", { error: err.message, stack: err.stack });
    await prismaClient.$disconnect();
    await shutdownRedis();
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down Customer Service...`);
  try {
    await shutdownRedis();
    await prismaClient.$disconnect();
    server.close(() => {
      logger.info("Customer Service shut down successfully");
      process.exit(0);
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Shutdown error: ${err.message}`, { stack: err.stack });
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (err: Error) => {
  logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
  shutdown("uncaughtException");
});
process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${String(reason)}`);
  shutdown("unhandledRejection");
});

main();