import dotenv from "dotenv";
import path from "path";
import express, { Request, Response, NextFunction, Application, RequestHandler } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUI from "swagger-ui-express";
import { createServer, Server } from "http";
import morgan from "morgan";
import winston from "winston";
import cluster from "cluster";
import os from "node:os";
import { initRedis, shutdownRedis, testRedisStability, isRedisError, getRedisClient } from "./config/redis";
import { ENV } from "./config/env";
import { rootRoutes } from "./routes/root";
import { errorHandler } from "./middlewares/errors";
import { initWebSocket } from "./websocket";
import fs from "fs";
import { startNotificationWorker, stopNotificationWorker } from "./workers/worker";
import { startCronJobs } from "./cronJob/cron";

// Load .env files only once in the primary process
if (cluster.isPrimary) {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
  dotenv.config({ path: path.resolve(__dirname, "../.env.customer"), override: true });
}

// Force production mode if needed
if (process.env.FORCE_PRODUCTION === 'true' || process.env.RUN_AS_PRODUCTION === 'true') {
  process.env.NODE_ENV = 'production';
}

// Initialize log directory
const logDir = path.resolve(ENV.LOG_DIR || "./logs");
if (cluster.isPrimary) {
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
      fs.chmodSync(logDir, 0o775);
    }
  } catch (err) {
    console.error(`Failed to create log directory: ${(err as Error).message}`);
  }
}

// Initialize Winston logger with clean formatting
const logger = winston.createLogger({
  level: ENV.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'customer-service' },
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, "customer-error.log"),
      level: "error",
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logDir, "customer-combined.log"),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, "exceptions.log"),
    }),
  ],
  exitOnError: false,
});

// Clean console output for development
if (ENV.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let log = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta)}`;
          }
          return log;
        })
      ),
    })
  );
} else {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      level: "info",
    })
  );
}

// Log environment variables once in the primary process
if (cluster.isPrimary) {
  logger.info("Environment variables loaded", {
    nodeEnv: ENV.NODE_ENV,
    apiPort: ENV.API_PORT,
    apiHost: ENV.API_HOST,
    corsOrigins: ENV.CORS_ORIGINS,
    redisUrl: ENV.REDIS_URL,
    webhookSecret: ENV.WEBHOOK_SECRET,
    flutterwaveWebhookSecret: ENV.FLUTTERWAVE_WEBHOOK_SECRET,
  });
}

// Enhanced cluster configuration
const isProductionMode = ENV.NODE_ENV === "production";
const shouldUseCluster = isProductionMode || process.env.ENABLE_CLUSTER === 'true';
const numCPUs = shouldUseCluster ? Math.min(os.cpus().length, 2) : 1;

// Global state for resource management
const globalState = {
  redisInitialized: false,
  prismaInitialized: false,
  resourcesInitializing: false,
  resourceInitPromise: null as Promise<boolean> | null,
};

// Initialize Prisma client
export const prismaClient = new PrismaClient({
  log: isProductionMode ? ["error", "warn"] : ["error", "warn"],
  datasources: {
    db: {
      url: ENV.POSTGRES_URL,
    },
  },
});

// Enhanced resource initialization with proper singleton pattern
const initializeGlobalResources = async (): Promise<boolean> => {
  if (globalState.redisInitialized && globalState.prismaInitialized) {
    logger.info(`Process ${process.pid}: Resources already initialized`);
    return true;
  }

  if (globalState.resourcesInitializing && globalState.resourceInitPromise) {
    return await globalState.resourceInitPromise;
  }

  globalState.resourcesInitializing = true;
  globalState.resourceInitPromise = new Promise(async (resolve) => {
    try {
      // Initialize Redis with connection pooling
      if (!globalState.redisInitialized) {
        logger.info(`Process ${process.pid}: Initializing Redis connection...`);
        await initRedis(2, 1500, true);
        globalState.redisInitialized = true;
        logger.info(`Process ${process.pid}: Redis connection initialized`);
      }

      // Initialize database connection
      if (!globalState.prismaInitialized) {
        logger.info(`Process ${process.pid}: Connecting to database...`);
        await prismaClient.$connect();
        globalState.prismaInitialized = true;
        logger.info(`Process ${process.pid}: Database connected successfully`);
      }

      // Test Redis stability
      const isStable = await testRedisStability(2, 50);
      if (!isStable) {
        logger.warn(`Process ${process.pid}: Redis stability test failed, but continuing...`);
      } else {
        logger.info(`Process ${process.pid}: Redis stability confirmed`);
      }

      resolve(true);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (isRedisError(error)) {
        logger.error(`Process ${process.pid}: Failed to initialize resources (Redis error): ${err.message}`, {
          code: error.code,
          stack: err.stack,
        });
      } else {
        logger.error(`Process ${process.pid}: Failed to initialize resources: ${err.message}`, {
          stack: err.stack,
        });
      }
      resolve(false);
    } finally {
      globalState.resourcesInitializing = false;
    }
  });

  return await globalState.resourceInitPromise;
};

// Application setup
interface AppSetupResult {
  app: Application;
  server: Server;
  setIsServerReady: (ready: boolean) => void;
}

const setupApplication = async (): Promise<AppSetupResult> => {
  const app: Application = express();
  const server = createServer(app);
  app.set("trust proxy", 1);

  let isServerReady = false;

  // Server readiness middleware
  const serverReadyMiddleware: RequestHandler = (req, res, next) => {
    if (
      !isServerReady &&
      !["/health", "/api/payments/callback", "/flutterwave/webhook", "/api-docs", "/api-docs/swagger.json"].includes(req.path)
    ) {
      res.status(503).json({
        success: false,
        message: "Service is starting, please try again later",
      });
      return;
    }
    next();
  };

  app.use(serverReadyMiddleware);

  // Initialize WebSocket (only once per process)
  if (!cluster.isPrimary || !shouldUseCluster) {
    try {
      initWebSocket(server);
      logger.info(`Process ${process.pid}: WebSocket server initialized for Customer Service`);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Process ${process.pid}: Failed to initialize WebSocket: ${err.message}`);
    }
  }

  // Middleware for webhook routes
  app.use("/flutterwave/webhook", express.raw({ type: "application/json" }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.originalUrl.startsWith("/flutterwave/webhook")) {
      return next();
    }
    return express.json({
      limit: "10mb",
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      },
    })(req, res, next);
  });

  app.use(express.urlencoded({ extended: true }));

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: false,
      hsts: isProductionMode,
    })
  );

  // Clean HTTP logging
  app.use(
    morgan(isProductionMode ? "combined" : "dev", {
      stream: {
        write: (message: string) => {
          const trimmed = message.trim();
          if (trimmed.length > 0) {
            logger.http(trimmed);
          }
        },
      },
      skip: (req: Request) => req.method === "OPTIONS" || req.path === "/health",
    })
  );

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProductionMode ? 1000 : 5000,
    message: { success: false, message: "Too many requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => req.path === "/health",
  });
  app.use(limiter);

  // CORS
  app.use(
    cors({
      origin: ENV.CORS_ORIGINS.length > 0 ? ENV.CORS_ORIGINS : ["http://localhost:3000", "http://localhost:4000"],
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      credentials: true,
      preflightContinue: false,
    })
  );

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.removeHeader("Cross-Origin-Opener-Policy");
    res.removeHeader("X-Powered-By");
    next();
  });

  // Swagger configuration
  let openapiSpecification: any;
  try {
    if (fs.existsSync(path.resolve(__dirname, "../swagger.json"))) {
      openapiSpecification = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../swagger.json"), "utf8"));
    } else {
      const swaggerOptions: swaggerJSDoc.Options = {
        failOnErrors: true,
        definition: {
          openapi: "3.0.0",
          info: {
            title: "Quicrefill Customer Service API",
            version: "1.0.0",
            description: "API documentation for Quicrefill Customer Service",
          },
          servers: [
            {
              url: ENV.NODE_ENV === "production"
                ? "https://api.quicrefill.com/api/customer"
                : "http://localhost:4000/api/customer",
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
        apis: ["./src/routes/**/*.ts", "./src/controllers/**/*.ts", "./src/index.ts"],
      };
      openapiSpecification = swaggerJSDoc(swaggerOptions);
    }

    if (ENV.NODE_ENV !== "production") {
      app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(openapiSpecification, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: "Quicrefill Customer API Docs",
      }));
      logger.info(`Process ${process.pid}: Swagger UI available at /api-docs`);
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Process ${process.pid}: Failed to initialize Swagger: ${err.message}`);
    openapiSpecification = { error: "Swagger initialization failed" };
  }

  app.get("/api-docs/swagger.json", (req: Request, res: Response) => {
    if (openapiSpecification.error) {
      res.status(500).json({
        success: false,
        message: "Failed to load Swagger specification",
        error: openapiSpecification.error,
      });
      return;
    }
    res.json(openapiSpecification);
  });

  // Health check endpoint
  app.get("/health", async (req: Request, res: Response) => {
    let redisStatus = "DOWN";
    let databaseStatus = "DOWN";
    let redisError: string | null = null;
    let databaseError: string | null = null;

    try {
      const redis = await getRedisClient();
      const pingResult = await Promise.race([
        redis.ping(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Redis ping timeout")), 2000)),
      ]);
      const isStable = await testRedisStability(1, 50);
      redisStatus = pingResult === "PONG" && isStable ? "UP" : "DOWN";
    } catch (error: unknown) {
      redisError = error instanceof Error ? error.message : String(error);
      if (isRedisError(error)) {
        logger.warn(`Redis health check failed (Redis error): ${redisError}`, {
          code: error.code,
        });
      } else {
        logger.warn(`Redis health check failed: ${redisError}`);
      }
    }

    try {
      await Promise.race([
        prismaClient.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Database query timeout")), 2000)),
      ]);
      databaseStatus = "UP";
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      databaseError = err.message;
    }

    const isHealthy = redisStatus === "UP" && databaseStatus === "UP";
    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      message: `Customer Service is ${isHealthy ? "running" : "unhealthy"}`,
      uptime: process.uptime(),
      timestamp: new Date(),
      services: {
        redis: {
          status: redisStatus,
          error: redisError,
          isRedisError: redisError ? isRedisError(new Error(redisError)) : false,
        },
        database: { status: databaseStatus, error: databaseError },
      },
      environment: ENV.NODE_ENV,
      version: "1.0.0",
      workerPid: process.pid,
      isPrimary: cluster.isPrimary,
      useCluster: shouldUseCluster,
    });
  });

  // Routes and error handling
  app.use("/", rootRoutes);
  app.use(errorHandler);

  return {
    app,
    server,
    setIsServerReady: (ready: boolean) => {
      isServerReady = ready;
    },
  };
};

// Server startup process
const startServerProcess = async () => {
  try {
    const { server, setIsServerReady } = await setupApplication();

    // Initialize resources with retry logic
    let resourcesInitialized = false;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        resourcesInitialized = await initializeGlobalResources();
        if (resourcesInitialized) break;

        if (attempt < 2) {
          logger.warn(`Process ${process.pid}: Resource initialization failed, retrying... (${attempt}/2)`);
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      } catch (error) {
        if (isRedisError(error)) {
          logger.error(`Process ${process.pid}: Resource initialization attempt ${attempt} failed (Redis error): ${error.message}`, {
            code: error.code,
          });
        } else {
          logger.error(`Process ${process.pid}: Resource initialization attempt ${attempt} failed: ${error}`);
        }
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    if (!resourcesInitialized) {
      logger.warn(`Process ${process.pid}: Continuing in degraded mode without full resource initialization`);
    }

    // Start notification worker only in appropriate processes
    if (!shouldUseCluster || !cluster.isPrimary) {
      try {
        await startNotificationWorker();
        logger.info(`Process ${process.pid}: Notification worker started`);
      } catch (err) {
        logger.warn(`Process ${process.pid}: Failed to start notification worker: ${err}`);
      }
    }

    // Mark server as ready and start listening
    setIsServerReady(true);

    server.listen(ENV.API_PORT, ENV.API_HOST, () => {
      logger.info(`🚀 Process ${process.pid}: Customer Service running on http://${ENV.API_HOST}:${ENV.API_PORT}/api/customer`);
      logger.info(`🔌 Process ${process.pid}: WebSocket Server running on ws://${ENV.API_HOST}:${ENV.API_PORT}/ws`);
      logger.info(`⚙️ Process ${process.pid}: Mode: ${ENV.NODE_ENV}, Cluster: ${shouldUseCluster ? 'enabled' : 'disabled'}`);

      if (ENV.NODE_ENV !== "production") {
        logger.info(`📚 Process ${process.pid}: API Documentation available at http://${ENV.API_HOST}:${ENV.API_PORT}/api-docs`);
      }

      if (shouldUseCluster && process.send) {
        process.send({ type: 'worker_ready', pid: process.pid });
      }
    });

    server.on('error', (error) => {
      logger.error(`Process ${process.pid}: Server error: ${error.message}`);
      if (error.message.includes('EADDRINUSE')) {
        logger.error(`Process ${process.pid}: Port ${ENV.API_PORT} is already in use`);
        process.exit(1);
      }
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (isRedisError(error)) {
      logger.error(`Process ${process.pid}: Failed to start server (Redis error): ${err.message}`, {
        code: error.code,
      });
    } else {
      logger.error(`Process ${process.pid}: Failed to start server: ${err.message}`);
    }
    process.exit(1);
  }
};

// Cluster management
if (shouldUseCluster && cluster.isPrimary) {
  logger.info(`🎯 Primary process ${process.pid} is running with ${numCPUs} workers`);
  logger.info(`🌐 Cluster mode: ENABLED - Primary process managing ${numCPUs} worker processes`);

  // Initialize resources in primary first
  initializeGlobalResources().then((success) => {
    if (success) {
      logger.info(`Primary process ${process.pid}: Resources initialized successfully`);
    }

    // Start background services in primary only
    try {
      startCronJobs();
      logger.info(`⏰ Cron jobs started in primary process ${process.pid}`);
    } catch (error) {
      logger.error(`Failed to start cron jobs: ${error}`);
    }

    try {
      startNotificationWorker();
      logger.info(`🔔 Notification worker started in primary process ${process.pid}`);
    } catch (error) {
      logger.warn(`Failed to start notification worker: ${error}`);
    }

    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
      const worker = cluster.fork();
      logger.info(`👶 Forked worker process ${worker.process.pid} (${i + 1}/${numCPUs})`);

      worker.on('message', (message) => {
        if (message.type === 'worker_ready') {
          logger.info(`✅ Worker ${worker.process.pid} is ready and listening`);
        }
      });
    }
  });

  // Cluster event handlers
  cluster.on("exit", (worker, code, signal) => {
    logger.warn(`💀 Worker ${worker.process.pid} died with code ${code}, signal ${signal}. Restarting...`);
    setTimeout(() => {
      const newWorker = cluster.fork();
      logger.info(`🔄 Restarted worker process ${newWorker.process.pid}`);
    }, 2000);
  });

  cluster.on("online", (worker) => {
    logger.info(`🟢 Worker ${worker.process.pid} is online`);
  });

  cluster.on("listening", (worker, address) => {
    logger.info(`👂 Worker ${worker.process.pid} is listening on ${address.address}:${address.port}`);
  });

  // Primary process shutdown handler
  const shutdownPrimary = async (signal: string) => {
    logger.info(`🛑 Primary process ${process.pid}: ${signal} received, shutting down cluster...`);

    try {
      await stopNotificationWorker();
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (isRedisError(error)) {
        logger.error(`Error stopping background workers (Redis error): ${err.message}`, {
          code: error.code,
        });
      } else {
        logger.error(`Error stopping background workers: ${err.message}`);
      }
    }

    for (const id in cluster.workers) {
      cluster.workers[id]?.disconnect();
    }

    setTimeout(() => {
      logger.info(`👑 Primary process ${process.pid}: Cluster shutdown complete`);
      process.exit(0);
    }, 5000);
  };

  process.on("SIGINT", () => shutdownPrimary("SIGINT"));
  process.on("SIGTERM", () => shutdownPrimary("SIGTERM"));
} else {
  // Worker process or single mode
  if (shouldUseCluster) {
    logger.info(`🔧 Worker process ${process.pid}: Starting server in cluster mode...`);
  } else {
    logger.info(`🔧 Process ${process.pid}: Starting server in single process mode...`);
  }

  startServerProcess().catch((error) => {
    if (isRedisError(error)) {
      logger.error(`💥 Process ${process.pid}: Failed to start server process (Redis error): ${error.message}`, {
        code: error.code,
      });
    } else {
      logger.error(`💥 Process ${process.pid}: Failed to start server process: ${error.message}`);
    }
    process.exit(1);
  });
}

// Graceful shutdown handler
const shutdown = async (signal: string) => {
  logger.info(`🛑 Process ${process.pid}: ${signal} received, shutting down...`);
  try {
    if (!shouldUseCluster || !cluster.isPrimary) {
      await stopNotificationWorker();
    }

    if (!shouldUseCluster || cluster.isPrimary) {
      await shutdownRedis();
      await prismaClient.$disconnect();
    }

    logger.info(`✅ Process ${process.pid}: Resources cleaned up successfully`);
    process.exit(0);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (isRedisError(error)) {
      logger.error(`❌ Process ${process.pid}: Shutdown error (Redis error): ${err.message}`, {
        code: error.code,
      });
    } else {
      logger.error(`❌ Process ${process.pid}: Shutdown error: ${err.message}`);
    }
    process.exit(1);
  }
};

// Process event handlers for workers/single mode
if (!shouldUseCluster || !cluster.isPrimary) {
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("uncaughtException", (err: Error) => {
    if (isRedisError(err)) {
      logger.error(`💥 Process ${process.pid}: Uncaught Exception (Redis error): ${err.message}`, {
        code: err.code,
      });
    } else {
      logger.error(`💥 Process ${process.pid}: Uncaught Exception: ${err.message}`);
    }
    shutdown("uncaughtException");
  });
  process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
    logger.error(`⚠️ Process ${process.pid}: Unhandled Rejection at: ${promise}, reason: ${String(reason)}`);
  });
}

export { setupApplication };