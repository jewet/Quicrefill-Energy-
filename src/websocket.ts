import { WebSocketServer, WebSocket } from "ws";
import { Server as HttpServer } from "http";
import { verify } from "jsonwebtoken";
import winston from "winston";
import { ENV } from "./config/env";
import path from "path";
import fs from "fs";

// Create log directory
const logDir = path.resolve(__dirname, "../logs");
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    console.log(`Created log directory: ${logDir}`);
  }
} catch (err) {
  console.error(`Failed to create log directory: ${(err as Error).message}`);
}

// Logger setup
const logger = winston.createLogger({
  level: ENV.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
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

const clients = new Map<string, WebSocket>();

export const initWebSocket = (server: HttpServer) => {
  const wss = new WebSocketServer({ server, path: "/ws" });
  logger.info("WebSocket server initialized for Customer Service");

  wss.on("connection", (ws: WebSocket, req) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      logger.warn("WebSocket connection rejected: No token provided");
      ws.close(1008, "Unauthorized: No token provided");
      return;
    }

    try {
      const decoded = verify(token, ENV.JWT_ACCESS_SECRET) as {
        id: string;
        role?: string;
      };

      if (decoded.role && decoded.role !== "CUSTOMER") {
        logger.warn(
          `WebSocket connection rejected for user ${decoded.id}: Customer role required`
        );
        ws.close(1008, "Unauthorized: Customer role required");
        return;
      }

      clients.set(decoded.id, ws);
      logger.info(`Customer ${decoded.id} connected via WebSocket`);

      ws.on("message", async (message) => {
        logger.info(`Received message from customer ${decoded.id}: ${message}`);
      });

      ws.on("close", () => {
        clients.delete(decoded.id);
        logger.info(`Customer ${decoded.id} disconnected from WebSocket`);
      });

      ws.on("error", (error) => {
        logger.error(
          `WebSocket error for customer ${decoded.id}: ${error.message}`
        );
      });
    } catch (error) {
      logger.error(
        `WebSocket connection rejected: Token verification failed - ${
          (error as Error).message
        }`
      );
      ws.close(1008, `Unauthorized: Token verification failed`);
    }
  });

  wss.on("error", (error) => {
    logger.error(`WebSocket server error: ${error.message}`);
  });
};