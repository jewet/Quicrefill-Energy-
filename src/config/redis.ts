import { createClient, RedisClientType, RedisClientOptions } from "redis";
import winston from "winston";
import { ENV } from "./env";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

// Initialize log directory once
const logDir = path.resolve(__dirname, "../../logs");
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    console.log(`Created log directory: ${logDir}`);
  }
} catch (err) {
  console.error(`Failed to create log directory: ${(err as Error).message}`);
}

// Initialize logger
const logger = winston.createLogger({
  level: ENV.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.metadata()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, "redis-error.log"),
      level: "error",
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logDir, "redis-combined.log"),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

if (ENV.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
      level: "info",
    })
  );
}

// Deduplication for Redis logs
const loggedMessages = new Set<string>();

// Type guard for Redis-specific errors
export interface RedisError extends Error {
  code?: string;
}

export const isRedisError = (error: unknown): error is RedisError => {
  return error instanceof Error && "code" in error;
};

// Define empty generics for Redis client
type RedisModules = Record<string, never>;
type RedisFunctions = Record<string, never>;
type RedisScripts = Record<string, never>;

// Singleton Redis client
let redisClient: RedisClientType<RedisModules, RedisFunctions, RedisScripts> | null = null;
let isInitializing = false;
let initializationPromise: Promise<void> | null = null;

const redisUrl = ENV.REDIS_URL || "redis://:x7kPmN9qL2vR8tW5zY3jB6hA4eD0cF@localhost:6379";
logger.debug(`Redis URL: ${redisUrl.replace(/:.*@/, ":<redacted>@")}`);

// Cache management settings
const CACHE_TTL_SECONDS = 300; // 5 minutes default TTL
const WEBHOOK_CACHE_PREFIX = "webhook:";
const CALLBACK_CACHE_PREFIX = "callback:";

// Slowlog threshold (in microseconds, 15000us = 15ms)
const SLOWLOG_THRESHOLD = 15000;

/**
 * Creates or returns the Redis client instance.
 */
const initializeClient = async (): Promise<RedisClientType<RedisModules, RedisFunctions, RedisScripts>> => {
  if (redisClient && redisClient.isOpen) {
    logger.debug("Reusing existing Redis client");
    return redisClient;
  }

  const redisOptions: RedisClientOptions<RedisModules, RedisFunctions, RedisScripts> = {
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries: number) => {
        if (retries >= 5) {
          logger.error("Redis connection failed after maximum retries", { retries });
          return new Error("Redis connection failed after maximum retries");
        }
        const delay = Math.min(300 * Math.pow(2, retries), 3000);
        logger.warn(`Redis reconnect attempt ${retries + 1}, waiting ${delay}ms`);
        return delay;
      },
      connectTimeout: 5000,
      keepAlive: 1000,
      tls: ENV.REDIS_TLS,
    },
    commandsQueueMaxLength: 5000,
    disableOfflineQueue: false,
  };

  redisClient = createClient(redisOptions);

  redisClient.on("error", (error: Error) => {
    const messageKey = `Redis Client Error: ${error.message}`;
    if (!loggedMessages.has(messageKey)) {
      logger.error(`Redis Client Error: ${error.message}`, {
        code: isRedisError(error) ? error.code : undefined,
        stack: error.stack,
      });
      loggedMessages.add(messageKey);
    }
  });

  redisClient.on("connect", () => {
    const messageKey = "Redis connection established";
    if (!loggedMessages.has(messageKey)) {
      logger.info(messageKey);
      loggedMessages.add(messageKey);
    }
  });

  redisClient.on("reconnecting", () => {
    logger.warn("Redis client reconnecting...");
  });

  redisClient.on("ready", async () => {
    const messageKey = "Redis client ready";
    if (!loggedMessages.has(messageKey)) {
      logger.info(messageKey);
      loggedMessages.add(messageKey);
      await logRedisStats();
      // Configure slowlog threshold
      if (redisClient) {
        try {
          await redisClient.configSet("slowlog-log-slower-than", SLOWLOG_THRESHOLD.toString());
          logger.info(`Set Redis slowlog threshold to ${SLOWLOG_THRESHOLD}us`);
        } catch (error) {
          logger.error(`Failed to set slowlog threshold: ${String(error)}`);
        }
      }
    }
  });

  redisClient.on("end", () => {
    const messageKey = "Redis connection closed";
    if (!loggedMessages.has(messageKey)) {
      logger.info(messageKey);
      loggedMessages.add(messageKey);
    }
  });

  if (!redisClient.isOpen) {
    try {
      await redisClient.connect();
    } catch (error) {
      logger.error(`Failed to connect Redis client: ${String(error)}`);
      redisClient = null; // Reset client on failure
      throw error;
    }
  }

  return redisClient;
};

/**
 * Logs Redis server stats and slowlog for debugging, with reduced frequency.
 */
const logRedisStats = async () => {
  const client = await getRedisClient(); // Use getRedisClient to ensure non-null client
  try {
    const clientList = await client.sendCommand(["CLIENT", "LIST"]);
    const info = await client.info("ALL");
    const connectedClients = info.match(/connected_clients:(\d+)/)?.[1] || "unknown";
    const maxClients = info.match(/maxclients:(\d+)/)?.[1] || "unknown";
    const blockedClients = info.match(/blocked_clients:(\d+)/)?.[1] || "0";
    const messageKey = `Redis server stats: ${connectedClients}/${maxClients}`;
    if (!loggedMessages.has(messageKey)) {
      logger.info("Redis server stats", {
        connectedClients,
        maxClients,
        blockedClients,
        clientListLength: clientList ? String(clientList).split("\n").length - 1 : 0,
      });
      loggedMessages.add(messageKey);
    }
    if (parseInt(connectedClients) >= parseInt(maxClients) * 0.8) {
      logger.warn("Redis server approaching maxclients limit", { connectedClients, maxClients });
    }
    if (parseInt(blockedClients) > 0) {
      logger.warn("Redis has blocked clients", { blockedClients });
    }

    // Check slowlog only every 10 minutes
    const lastSlowlogCheck = await client.get("last_slowlog_check");
    const now = Date.now();
    if (!lastSlowlogCheck || now - parseInt(lastSlowlogCheck) > 600000) {
      const slowlog = await client.sendCommand(["SLOWLOG", "GET", "10"]);
      await client.set("last_slowlog_check", now.toString(), { EX: 3600 });
      if (slowlog && Array.isArray(slowlog)) {
        const slowCommands = slowlog
          .map((entry: any) => ({
            id: entry[0],
            timestamp: new Date(entry[1] * 1000).toISOString(),
            duration: entry[2],
            command: entry[3].join(" "),
          }))
          .filter((entry: any) => !entry.command.includes("INFO")); // Filter out INFO commands
        if (slowCommands.length > 0) {
          const messageKey = `Detected slow Redis commands: ${slowCommands[0].id}`;
          if (!loggedMessages.has(messageKey)) {
            logger.warn("Detected slow Redis commands", { slowCommands });
            loggedMessages.add(messageKey);
          }
        }
      }
      // Clear slowlog to prevent accumulation
      await client.sendCommand(["SLOWLOG", "RESET"]);
      logger.info("Redis slowlog cleared");
    }
  } catch (error: unknown) {
    logger.error("Failed to log Redis stats", { error: String(error) });
  }
};

/**
 * Initializes Redis connection with retries and stability check.
 */
export const initRedis = async (
  maxRetries: number = 5,
  retryDelay: number = 2000,
  failOnError: boolean = true
): Promise<void> => {
  const initId = uuidv4();
  const client = await initializeClient();

  if (client.isReady) {
    const messageKey = `Redis already initialized:${initId}`;
    if (!loggedMessages.has(messageKey)) {
      logger.info("Redis already initialized", { initId });
      loggedMessages.add(messageKey);
    }
    return;
  }

  if (isInitializing) {
    logger.debug("Redis initialization in progress, waiting", { initId });
    return initializationPromise || Promise.resolve();
  }

  isInitializing = true;
  logger.debug("Starting Redis initialization", { initId });

  initializationPromise = new Promise<void>(async (resolve, reject) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!client.isOpen) {
          await client.connect();
        }
        const pingResult = await client.ping();
        if (pingResult !== "PONG") {
          throw new Error("Redis ping failed");
        }

        const setResult = await client.set("init_test_key", "test_value", { EX: 60 });
        if (setResult !== "OK") {
          throw new Error("Redis set test failed");
        }

        if (!(await testRedisStability(3, 1000))) {
          throw new Error("Redis connection is unstable");
        }

        await logRedisStats();
        logger.info("Redis initialized successfully", { initId });
        isInitializing = false;
        initializationPromise = null;
        resolve();
        return;
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error(`Redis connection attempt ${attempt}/${maxRetries} failed: ${errMsg}`, {
          initId,
          stack: error instanceof Error ? error.stack : undefined,
          code: isRedisError(error) ? error.code : undefined,
        });
        if (attempt === maxRetries) {
          isInitializing = false;
          initializationPromise = null;
          if (failOnError) {
            logger.error(`Redis initialization failed after ${maxRetries} attempts`);
            reject(new Error("Redis initialization failed"));
            return;
          }
          logger.warn("Continuing without Redis", { initId });
          resolve();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1)));
      }
    }
  });

  return initializationPromise;
};

/**
 * Tests Redis connection stability by performing multiple pings and a write operation.
 */
export const testRedisStability = async (attempts: number = 3, delay: number = 1000): Promise<boolean> => {
  const client = await getRedisClient(); // Use getRedisClient to ensure non-null client
  for (let i = 0; i < attempts; i++) {
    try {
      const pingResult = await client.ping();
      if (pingResult !== "PONG") {
        logger.warn(`Redis stability test failed on ping attempt ${i + 1}`);
        return false;
      }
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error: unknown) {
      logger.error(`Redis stability test failed: ${String(error)}`);
      return false;
    }
  }

  try {
    const setResult = await client.set("stability_test", "test_value", { EX: 60 });
    if (setResult !== "OK") {
      logger.warn("Redis stability test failed on write operation");
      return false;
    }
    logger.info("Redis stability test passed");
    return true;
  } catch (error: unknown) {
    logger.error(`Redis stability test failed on write: ${String(error)}`);
    return false;
  }
};

/**
 * Gracefully shuts down Redis connection.
 */
export const shutdownRedis = async (): Promise<void> => {
  const client = await getRedisClient(); // Use getRedisClient to ensure non-null client
  try {
    await client.quit();
    logger.info("Redis client disconnected");
    redisClient = null;
    loggedMessages.clear();
  } catch (error: unknown) {
    logger.error(`Redis disconnection failed: ${String(error)}`);
    throw error;
  }
};

/**
 * Returns the Redis client instance.
 */
export const getRedisClient = async (timeoutMs = 5000): Promise<RedisClientType<RedisModules, RedisFunctions, RedisScripts>> => {
  return await Promise.race([
    initializeClient(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Redis client retrieval timed out")), timeoutMs))
  ]);
};

/**
 * Prevents stale caches by setting TTL and validating cache entries.
 */
export const setCache = async (key: string, value: string, ttlSeconds: number = CACHE_TTL_SECONDS): Promise<void> => {
  const client = await getRedisClient(); // Use getRedisClient to ensure non-null client
  try {
    await client.set(key, value, { EX: ttlSeconds });
    logger.debug(`Cache set for key: ${key}, TTL: ${ttlSeconds}s`);
  } catch (error: unknown) {
    logger.error(`Failed to set cache for key: ${key}`, { error: String(error) });
    throw error;
  }
};

/**
 * Retrieves cache with staleness check.
 */
export const getCache = async (key: string): Promise<string | null> => {
  const client = await getRedisClient(); // Use getRedisClient to ensure non-null client
  try {
    const value = await client.get(key);
    if (value) {
      logger.debug(`Cache hit for key: ${key}`);
      const ttl = await client.ttl(key);
      if (ttl < 0) {
        logger.warn(`Cache entry expired for key: ${key}`);
        await client.del(key);
        return null;
      }
    } else {
      logger.debug(`Cache miss for key: ${key}`);
    }
    return value;
  } catch (error: unknown) {
    logger.error(`Failed to get cache for key: ${key}`, { error: String(error) });
    return null;
  }
};

/**
 * Invalidates cache for specific keys or patterns (e.g., webhooks, callbacks).
 */
export const invalidateCache = async (pattern: string): Promise<void> => {
  const client = await getRedisClient(); // Use getRedisClient to ensure non-null client
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
      logger.info(`Invalidated ${keys.length} cache keys for pattern: ${pattern}`);
    }
  } catch (error: unknown) {
    logger.error(`Failed to invalidate cache for pattern: ${pattern}`, { error: String(error) });
  }
};

/**
 * Stores webhook or callback data with automatic invalidation.
 */
export const storeWebhook = async (id: string, data: any): Promise<void> => {
  const key = `${WEBHOOK_CACHE_PREFIX}${id}`;
  await setCache(key, JSON.stringify(data), 3600);
  logger.info(`Stored webhook data for ID: ${id}`);
};

/**
 * Stores callback data with automatic invalidation.
 */
export const storeCallback = async (id: string, data: any): Promise<void> => {
  const key = `${CALLBACK_CACHE_PREFIX}${id}`;
  await setCache(key, JSON.stringify(data), 3600);
  logger.info(`Stored callback data for ID: ${id}`);
};

/**
 * Cleans up expired webhook and callback data.
 */
export const cleanupWebhooksAndCallbacks = async (): Promise<void> => {
  try {
    await invalidateCache(`${WEBHOOK_CACHE_PREFIX}*`);
    await invalidateCache(`${CALLBACK_CACHE_PREFIX}*`);
    logger.info("Cleaned up webhook and callback caches");
  } catch (error: unknown) {
    logger.error("Failed to clean up webhook and callback caches", { error: String(error) });
  }
};

/**
 * Clears Redis slowlog.
 */
export const clearRedisSlowlog = async (): Promise<void> => {
  const client = await getRedisClient(); // Use getRedisClient to ensure non-null client
  try {
    await client.sendCommand(["SLOWLOG", "RESET"]);
    logger.info("Redis slowlog cleared");
  } catch (error: unknown) {
    logger.error("Failed to clear Redis slowlog", { error: String(error) });
  }
};