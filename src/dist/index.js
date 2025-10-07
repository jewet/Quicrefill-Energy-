"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.prismaClient = void 0;
var dotenv_1 = require("dotenv");
var path_1 = require("path");
// Load .env files before any other imports
dotenv_1["default"].config({ path: path_1["default"].resolve(__dirname, "../.env") });
dotenv_1["default"].config({ path: path_1["default"].resolve(__dirname, "../.env.customer"), override: true });
console.log("index.ts: LOG_DIR after dotenv: " + process.env.LOG_DIR); // Debug log
var express_1 = require("express");
var helmet_1 = require("helmet");
var express_rate_limit_1 = require("express-rate-limit");
var cors_1 = require("cors");
var client_1 = require("@prisma/client");
var swagger_jsdoc_1 = require("swagger-jsdoc");
var swagger_ui_express_1 = require("swagger-ui-express");
var http_1 = require("http");
var morgan_1 = require("morgan");
var winston_1 = require("winston");
var redis_1 = require("./config/redis");
var env_1 = require("./config/env");
var root_1 = require("./routes/root");
var errors_1 = require("./middlewares/errors");
var websocket_1 = require("./websocket");
var fs_1 = require("fs");
var walletnotification_1 = require("./workers/walletnotification");
// Initialize Winston logger
var logger = winston_1["default"].createLogger({
    level: env_1.ENV.LOG_LEVEL || "info",
    format: winston_1["default"].format.combine(winston_1["default"].format.timestamp(), winston_1["default"].format.json()),
    transports: [
        new winston_1["default"].transports.File({
            filename: path_1["default"].join(path_1["default"].resolve(env_1.ENV.LOG_DIR || "./logs"), "customer-error.log"),
            level: "error"
        }),
        new winston_1["default"].transports.File({
            filename: path_1["default"].join(path_1["default"].resolve(env_1.ENV.LOG_DIR || "./logs"), "customer-combined.log")
        }),
    ]
});
if (env_1.ENV.NODE_ENV !== "production") {
    logger.add(new winston_1["default"].transports.Console({
        format: winston_1["default"].format.combine(winston_1["default"].format.colorize(), winston_1["default"].format.simple())
    }));
}
// Log critical configurations
logger.info("Starting Customer Service...");
logger.info("NODE_ENV: " + env_1.ENV.NODE_ENV);
logger.info("API_PORT: " + env_1.ENV.API_PORT);
logger.info("API_GATEWAY_URL: " + env_1.ENV.API_GATEWAY_URL);
logger.info("CORS_ORIGINS: " + env_1.ENV.CORS_ORIGINS.join(", "));
logger.info("LOG_DIR: " + env_1.ENV.LOG_DIR);
logger.info("REDIS_URL: " + env_1.ENV.REDIS_URL.replace(/:.*@/, ":<redacted>@"));
// Initialize Express app and HTTP server
var app = express_1["default"]();
var server = http_1.createServer(app);
// Enable trust proxy for ngrok or other proxies
app.set("trust proxy", 1);
// Flag to indicate server readiness
var isServerReady = false;
// Middleware to block requests until server is ready
var serverReadyMiddleware = function (req, res, next) {
    // Allow health check and payment callback/webhook routes even if server isn't ready
    if (!isServerReady &&
        req.path !== "/health" &&
        req.path !== "/api/payments/callback" &&
        req.path !== "/flutterwave/webhook") {
        res.status(503).json({
            success: false,
            message: "Service is starting, please try again later"
        });
        return;
    }
    next();
};
app.use(serverReadyMiddleware);
// Initialize WebSocket
try {
    websocket_1.initWebSocket(server);
}
catch (error) {
    var err = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to initialize WebSocket: " + err.message, { stack: err.stack });
    process.exit(1);
}
// Initialize Prisma client
exports.prismaClient = new client_1.PrismaClient({
    log: ["error", "warn"],
    datasources: {
        db: {
            url: env_1.ENV.POSTGRES_URL
        }
    }
});
// Apply express.raw() for webhook routes before any JSON parsing
app.use("/flutterwave/webhook", express_1["default"].raw({ type: "application/json" }));
// Apply express.json() for other routes, skipping webhook routes
app.use(function (req, res, next) {
    if (req.originalUrl.startsWith("/flutterwave/webhook")) {
        return next(); // Skip JSON parsing for webhook
    }
    return express_1["default"].json({
        limit: "10mb",
        verify: function (req, res, buf) {
            req.rawBody = buf; // Store raw body as Buffer for non-webhook routes
        }
    })(req, res, next);
});
app.use(express_1["default"].urlencoded({ extended: true }));
app.use(helmet_1["default"]({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            connectSrc: [
                "'self'",
                env_1.ENV.NODE_ENV === "production"
                    ? "https://api.quicrefill.com"
                    : env_1.ENV.API_GATEWAY_URL || "http://localhost:4000",
                env_1.ENV.NODE_ENV === "production"
                    ? "wss://api.quicrefill.com"
                    : "ws://" + ((env_1.ENV.API_GATEWAY_URL || "http://localhost:4000").split("://")[1] || "localhost:4000"),
            ]
        }
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}));
// Morgan logging
app.use(morgan_1["default"]("combined", {
    stream: {
        write: function (message) {
            logger.http(message.trim());
        }
    },
    skip: function (req) { return req.method === "OPTIONS" || req.path === "/health"; }
}));
// Rate limiter
var limiter = express_rate_limit_1["default"]({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: "Too many requests from this IP, please try again after 15 minutes."
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: function (req) { return req.path === "/health"; }
});
app.use(limiter);
// CORS configuration
app.use(cors_1["default"]({
    origin: env_1.ENV.CORS_ORIGINS.length > 0
        ? env_1.ENV.CORS_ORIGINS
        : env_1.ENV.NODE_ENV === "production"
            ? "https://api.quicrefill.com"
            : "http://localhost:4000",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
    preflightContinue: false
}));
// Remove unnecessary headers
app.use(function (req, res, next) {
    res.removeHeader("Cross-Origin-Opener-Policy");
    res.removeHeader("X-Powered-By");
    next();
});
// Swagger configuration
var openapiSpecification;
if (fs_1["default"].existsSync("./swagger.json")) {
    logger.info("Loading static Swagger JSON from ./swagger.json");
    openapiSpecification = JSON.parse(fs_1["default"].readFileSync("./swagger.json", "utf8"));
}
else {
    logger.info("Generating Swagger specification dynamically");
    var swaggerOptions = {
        failOnErrors: true,
        definition: {
            openapi: "3.0.0",
            info: {
                title: "Quicrefill Customer Service API",
                version: "1.0.0",
                description: "API documentation for Quicrefill Customer Service, managing accounts and authentication",
                contact: { name: "Quicrefill Support", email: "support@quicrefill.com" }
            },
            servers: [
                {
                    url: env_1.ENV.NODE_ENV === "production"
                        ? "https://api.quicrefill.com/api/customer"
                        : (env_1.ENV.API_GATEWAY_URL || "http://localhost:4000") + "/api/customer",
                    description: env_1.ENV.NODE_ENV === "production"
                        ? "Production server via API Gateway"
                        : "Development server"
                },
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: "http",
                        scheme: "bearer",
                        bearerFormat: "JWT"
                    }
                }
            }
        },
        apis: ["./src/routes/**/*.ts", "./src/index.ts"]
    };
    openapiSpecification = swagger_jsdoc_1["default"](swaggerOptions);
}
// Swagger JSON endpoint
app.get("/api-docs/swagger.json", function (req, res) {
    res.json(openapiSpecification);
});
// Swagger UI with auth
var protectApiDocs = function (req, res, next) {
    var authHeader = req.headers.authorization;
    var validUsername = env_1.ENV.API_DOCS_USERNAME || "admin";
    var validPassword = env_1.ENV.API_DOCS_PASSWORD || "admin123";
    if (!authHeader || !authHeader.startsWith("Basic ")) {
        res.setHeader("WWW-Authenticate", 'Basic realm="API Docs"');
        res.status(401).json({ success: false, message: "Authentication required" });
        return;
    }
    var base64Credentials = authHeader.split(" ")[1];
    var credentials = Buffer.from(base64Credentials, "base64").toString("ascii");
    var _a = credentials.split(":"), username = _a[0], password = _a[1];
    if (username === validUsername && password === validPassword) {
        logger.info("API documentation accessed by user: " + username);
        next();
        return;
    }
    res.setHeader("WWW-Authenticate", 'Basic realm="API Docs"');
    res.status(401).json({ success: false, message: "Invalid credentials" });
};
app.use("/api-docs", protectApiDocs, swagger_ui_express_1["default"].serve, swagger_ui_express_1["default"].setup(openapiSpecification, {
    customSiteTitle: "Quicrefill Customer Service API Documentation",
    swaggerOptions: {
        schemes: ["http", "https"],
        url: env_1.ENV.NODE_ENV === "production"
            ? "https://api.quicrefill.com/api-docs/customer/swagger.json"
            : (env_1.ENV.API_GATEWAY_URL || "http://localhost:4000") + "/api-docs/customer/swagger.json",
        validatorUrl: null,
        displayRequestDuration: true
    }
}));
// Health check
app.get("/health", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var redisStatus, databaseStatus, postgisStatus, redisError, databaseError, postgisError, redis, pingPromise, pingResult, isRedisConnected, isRedisStable, error_1, err, queryPromise, error_2, err, postgisCheck, error_3, err, isHealthy;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                redisStatus = "DOWN";
                databaseStatus = "DOWN";
                postgisStatus = "DOWN";
                redisError = null;
                databaseError = null;
                postgisError = null;
                _b.label = 1;
            case 1:
                _b.trys.push([1, 4, , 5]);
                redis = redis_1.getRedisClient();
                pingPromise = redis.ping();
                return [4 /*yield*/, Promise.race([
                        pingPromise,
                        new Promise(function (_, reject) { return setTimeout(function () { return reject(new Error("Redis ping timeout")); }, 2000); }),
                    ])];
            case 2:
                pingResult = _b.sent();
                isRedisConnected = pingResult === "PONG";
                return [4 /*yield*/, Promise.race([
                        redis_1.testRedisStability(3, 500),
                        new Promise(function (_, reject) { return setTimeout(function () { return reject(new Error("Redis stability timeout")); }, 2000); }),
                    ])];
            case 3:
                isRedisStable = _b.sent();
                redisStatus = isRedisConnected && isRedisStable ? "UP" : "DOWN";
                logger.info("Redis health check: " + redisStatus, {
                    isConnected: isRedisConnected,
                    isStable: isRedisStable,
                    url: env_1.ENV.REDIS_URL.replace(/:.*@/, ":<redacted>@")
                });
                return [3 /*break*/, 5];
            case 4:
                error_1 = _b.sent();
                err = error_1 instanceof Error ? error_1 : new Error(String(error_1));
                redisError = err.message;
                logger.error("Redis health check failed: " + redisError, {
                    stack: err.stack,
                    code: redis_1.isRedisError(error_1) ? error_1.code : undefined
                });
                return [3 /*break*/, 5];
            case 5:
                _b.trys.push([5, 7, , 8]);
                queryPromise = exports.prismaClient.$queryRaw(templateObject_1 || (templateObject_1 = __makeTemplateObject(["SELECT 1"], ["SELECT 1"])));
                return [4 /*yield*/, Promise.race([
                        queryPromise,
                        new Promise(function (_, reject) { return setTimeout(function () { return reject(new Error("Database query timeout")); }, 2000); }),
                    ])];
            case 6:
                _b.sent();
                logger.info("PostgreSQL connection successful");
                databaseStatus = "UP";
                return [3 /*break*/, 8];
            case 7:
                error_2 = _b.sent();
                err = error_2 instanceof Error ? error_2 : new Error(String(error_2));
                databaseError = err.message;
                logger.error("Database health check failed: " + databaseError, { stack: err.stack });
                return [3 /*break*/, 8];
            case 8:
                _b.trys.push([8, 10, , 11]);
                return [4 /*yield*/, Promise.race([
                        exports.prismaClient.$queryRaw(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n        SELECT EXISTS (\n          SELECT FROM pg_extension WHERE extname = 'postgis'\n        ) AS postgis_installed;\n      "], ["\n        SELECT EXISTS (\n          SELECT FROM pg_extension WHERE extname = 'postgis'\n        ) AS postgis_installed;\n      "]))),
                        new Promise(function (_, reject) { return setTimeout(function () { return reject(new Error("PostGIS query timeout")); }, 2000); }),
                    ])];
            case 9:
                postgisCheck = _b.sent();
                postgisStatus = ((_a = postgisCheck[0]) === null || _a === void 0 ? void 0 : _a.postgis_installed) ? "UP" : "DOWN";
                logger.info("PostGIS health check: " + postgisStatus);
                return [3 /*break*/, 11];
            case 10:
                error_3 = _b.sent();
                err = error_3 instanceof Error ? error_3 : new Error(String(error_3));
                postgisError = err.message;
                logger.warn("PostGIS health check failed: " + postgisError, { stack: err.stack });
                return [3 /*break*/, 11];
            case 11:
                isHealthy = databaseStatus === "UP";
                res.status(isHealthy ? 200 : 503).json({
                    success: isHealthy,
                    message: "Customer Service is " + (isHealthy ? "running" : "unhealthy"),
                    uptime: process.uptime(),
                    timestamp: new Date(),
                    gatewayUrl: env_1.ENV.NODE_ENV === "production"
                        ? "https://api.quicrefill.com"
                        : env_1.ENV.API_GATEWAY_URL || "http://localhost:4000",
                    redisStatus: redisStatus,
                    redisError: redisError,
                    databaseStatus: databaseStatus,
                    databaseError: databaseError,
                    postgisStatus: postgisStatus,
                    postgisError: postgisError,
                    environment: env_1.ENV.NODE_ENV,
                    version: "1.0.0"
                });
                return [2 /*return*/];
        }
    });
}); });
// Mount root routes
app.use("/", root_1.rootRoutes);
// Error handler
app.use(errors_1.errorHandler);
// Initialize log directory
var initializeLogDir = function () {
    var logDir = path_1["default"].resolve(env_1.ENV.LOG_DIR || "./logs");
    console.log("index.ts: Initializing log directory: " + logDir); // Debug log
    console.log("index.ts: LOG_DIR env: " + env_1.ENV.LOG_DIR); // Debug log
    try {
        if (!fs_1["default"].existsSync(logDir)) {
            fs_1["default"].mkdirSync(logDir, { recursive: true });
            fs_1["default"].chmodSync(logDir, 509);
            logger.info("Log directory initialized at " + logDir);
        }
    }
    catch (error) {
        var err = error instanceof Error ? error : new Error(String(error));
        logger.error("Failed to initialize log directory: " + err.message, { stack: err.stack });
        throw err; // Exit if log dir cannot be created
    }
};
// Start server with retries
var startServer = function () { return __awaiter(void 0, void 0, void 0, function () {
    var maxRetries, attempt, redis, isRedisStable, error_4, err, error_5, err;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                maxRetries = 3;
                attempt = 1;
                _a.label = 1;
            case 1:
                if (!(attempt <= maxRetries)) return [3 /*break*/, 12];
                _a.label = 2;
            case 2:
                _a.trys.push([2, 9, , 11]);
                initializeLogDir();
                redis = redis_1.getRedisClient();
                logger.info("Redis client status", {
                    isOpen: redis.isOpen,
                    isReady: redis.isReady,
                    url: env_1.ENV.REDIS_URL.replace(/:.*@/, ":<redacted>@")
                });
                return [4 /*yield*/, exports.prismaClient.$connect()];
            case 3:
                _a.sent();
                logger.info("Prisma client connected successfully");
                return [4 /*yield*/, redis_1.testRedisStability(5, 1000)];
            case 4:
                isRedisStable = _a.sent();
                if (!isRedisStable) {
                    throw new Error("Redis connection is unstable");
                }
                logger.info("Starting notification worker after Redis and Prisma initialization");
                _a.label = 5;
            case 5:
                _a.trys.push([5, 7, , 8]);
                logger.debug("Calling startNotificationWorker");
                return [4 /*yield*/, walletnotification_1.startNotificationWorker()];
            case 6:
                _a.sent();
                logger.debug("Notification worker started successfully");
                return [3 /*break*/, 8];
            case 7:
                error_4 = _a.sent();
                err = error_4 instanceof Error ? error_4 : new Error(String(error_4));
                logger.error("Failed to start notification worker", {
                    error: err.message,
                    stack: err.stack
                });
                throw err;
            case 8:
                isServerReady = true;
                logger.debug("Starting server listen on http://" + env_1.ENV.API_HOST + ":" + env_1.ENV.API_PORT);
                server.listen(env_1.ENV.API_PORT, env_1.ENV.API_HOST, function () {
                    logger.info("Customer Service running on http://" + env_1.ENV.API_HOST + ":" + env_1.ENV.API_PORT + "/api/customer");
                    logger.info("WebSocket Server running on ws://" + env_1.ENV.API_HOST + ":" + env_1.ENV.API_PORT + "/ws");
                    logger.info("Swagger UI available at http://" + env_1.ENV.API_HOST + ":" + env_1.ENV.API_PORT + "/api-docs");
                    logger.info("Proxied via API Gateway at " + (env_1.ENV.NODE_ENV === "production" ? "https://api.quicrefill.com/api-docs/customer" : (env_1.ENV.API_GATEWAY_URL || "http://localhost:4000") + "/api-docs/customer"));
                    logger.info("Using API Gateway at " + (env_1.ENV.API_GATEWAY_URL || "http://localhost:4000"));
                });
                logger.debug("Server listen initiated");
                return [2 /*return*/];
            case 9:
                error_5 = _a.sent();
                err = error_5 instanceof Error ? error_5 : new Error(String(error_5));
                logger.error("Start server attempt " + attempt + "/" + maxRetries + " failed: " + err.message, {
                    stack: err.stack,
                    code: redis_1.isRedisError(error_5) ? error_5.code : undefined,
                    rawError: JSON.stringify(error_5)
                });
                if (attempt === maxRetries) {
                    logger.error("Failed to start Customer Service after " + maxRetries + " attempts", { error: err });
                    throw err;
                }
                attempt++;
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000 * attempt); })];
            case 10:
                _a.sent();
                return [3 /*break*/, 11];
            case 11: return [3 /*break*/, 1];
            case 12: return [2 /*return*/];
        }
    });
}); };
// Main function to orchestrate startup
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var error_6, err;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 6]);
                    return [4 /*yield*/, redis_1.initRedis(10, 2000, true)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, startServer()];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 3:
                    error_6 = _a.sent();
                    err = error_6 instanceof Error ? error_6 : new Error(String(error_6));
                    logger.error("Application startup failed", { error: err.message, stack: err.stack });
                    return [4 /*yield*/, exports.prismaClient.$disconnect()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, redis_1.shutdownRedis()];
                case 5:
                    _a.sent();
                    process.exit(1);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// Graceful shutdown
var shutdown = function (signal) { return __awaiter(void 0, void 0, void 0, function () {
    var error_7, err;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                logger.info(signal + " received, shutting down Customer Service...");
                _a.label = 1;
            case 1:
                _a.trys.push([1, 5, , 6]);
                return [4 /*yield*/, walletnotification_1.stopNotificationWorker()];
            case 2:
                _a.sent();
                return [4 /*yield*/, redis_1.shutdownRedis()];
            case 3:
                _a.sent();
                return [4 /*yield*/, exports.prismaClient.$disconnect()];
            case 4:
                _a.sent();
                server.close(function () {
                    logger.info("Customer Service shut down successfully");
                    process.exit(0);
                });
                return [3 /*break*/, 6];
            case 5:
                error_7 = _a.sent();
                err = error_7 instanceof Error ? error_7 : new Error(String(error_7));
                logger.error("Shutdown error: " + err.message, { stack: err.stack });
                process.exit(1);
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); };
process.on("SIGINT", function () { return shutdown("SIGINT"); });
process.on("SIGTERM", function () { return shutdown("SIGTERM"); });
process.on("uncaughtException", function (err) {
    logger.error("Uncaught Exception: " + err.message, { stack: err.stack });
    shutdown("uncaughtException");
});
process.on("unhandledRejection", function (reason, promise) {
    logger.error("Unhandled Rejection at: " + promise + ", reason: " + String(reason));
    shutdown("unhandledRejection");
});
main();
var templateObject_1, templateObject_2;
