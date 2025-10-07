"use strict";
var _a;
exports.__esModule = true;
exports.ENV = void 0;
var dotenv_1 = require("dotenv");
var path_1 = require("path");
var logger_1 = require("../utils/logger");
dotenv_1["default"].config({ path: path_1["default"].resolve(__dirname, "../../.env") });
dotenv_1["default"].config({ path: path_1["default"].resolve(__dirname, "../../.env.customer"), override: true });
var logger = new logger_1.Logger("Config");
var requiredEnvVars = [
    "NODE_ENV",
    "API_HOST",
    "API_PORT",
    "API_GATEWAY_URL",
    "POSTGRES_URL",
    "REDIS_URL",
    "JWT_SECRET",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "AUTH_SERVICE_URL",
    "STORAGE_SERVICE_URL",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "EMAIL_FROM",
    "EMAIL_FROM_ADDRESS",
    "FLUTTERWAVE_PUBLIC_KEY",
    "FLUTTERWAVE_SECRET_KEY",
    "FLUTTERWAVE_ENCRYPTION_KEY",
    "TERMII_API_KEY",
    "TERMII_BASE_URL",
    "CORS_ORIGINS",
    "API_DOCS_USERNAME",
    "API_DOCS_PASSWORD",
    "LOG_LEVEL",
    "LOG_DIR",
    "WEBHOOK_SECRET",
    "FLUTTERWAVE_WEBHOOK_SECRET",
];
var missingVars = requiredEnvVars.filter(function (varName) { return !process.env[varName]; });
if (process.env.BUILD_ENV !== "build" && missingVars.length > 0) {
    logger.error("Missing required environment variables: " + missingVars.join(", "));
    throw new Error("Missing required environment variables: " + missingVars.join(", "));
}
// Validate REDIS_URL format
var redisUrlRegex = /^redis:\/\/(:[^@]+)?@[^:]+:\d+$/;
if (process.env.REDIS_URL && !redisUrlRegex.test(process.env.REDIS_URL)) {
    logger.error("Invalid REDIS_URL format: " + process.env.REDIS_URL);
    throw new Error("Invalid REDIS_URL format: " + process.env.REDIS_URL);
}
exports.ENV = {
    NODE_ENV: process.env.NODE_ENV || "production",
    API_HOST: process.env.API_HOST || "0.0.0.0",
    API_PORT: parseInt(process.env.API_PORT || "5000", 10),
    API_GATEWAY_URL: process.env.API_GATEWAY_URL || "https://api.quicrefill.com",
    POSTGRES_URL: process.env.POSTGRES_URL || "postgresql://quicrefill:securePassword123@postgres:5432/quicrefill_db",
    REDIS_URL: process.env.REDIS_URL || "redis://:x7kPmN9qL2vR8tW5zY3jB6hA4eD0cF@redis:6379",
    REDIS_HOST: process.env.REDIS_HOST || "redis",
    REDIS_PORT: parseInt(process.env.REDIS_PORT || "6379", 10),
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || "x7kPmN9qL2vR8tW5zY3jB6hA4eD0cF",
    REDIS_TLS: false,
    JWT_SECRET: process.env.JWT_SECRET || "3d5983232a027525e407dad64b09da4a98ccdf03237faf31a40232d82d425cf7",
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "vGqZ/eYcSK4X2OyouOjgyHEE1bzrNRpxnb4ZvYrVdB8=",
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "u7ABDBQ+q6/NoUaZkkTU+vLfCikC0XgiGFCkjlRbK10=",
    AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || "http://customer-service:5000",
    STORAGE_SERVICE_URL: process.env.STORAGE_SERVICE_URL || "http://storage-service:5004",
    ADMIN_SERVICE_URL: process.env.ADMIN_SERVICE_URL || "http://admin-service:5003",
    VENDOR_SERVICE_URL: process.env.VENDOR_SERVICE_URL || "http://vendor-service:5001",
    SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
    SMTP_PORT: parseInt(process.env.SMTP_PORT || "587", 10),
    SMTP_USER: process.env.SMTP_USER || "astralearnia@gmail.com",
    SMTP_PASSWORD: process.env.SMTP_PASSWORD || "nhnq tfok fhso dgpj",
    EMAIL_FROM: process.env.EMAIL_FROM || "astralearnia@gmail.com",
    EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS || "Astralearnia ",
    FLUTTERWAVE_PUBLIC_KEY: process.env.FLUTTERWAVE_PUBLIC_KEY || "FLWPUBK-6891622acbab6c9f96c83f7ce46dca5e-X",
    FLUTTERWAVE_SECRET_KEY: process.env.FLUTTERWAVE_SECRET_KEY || "FLWSECK-14debc6a638080e27437310c02347ace-1959488a8c1vt-X",
    FLUTTERWAVE_ENCRYPTION_KEY: process.env.FLUTTERWAVE_ENCRYPTION_KEY || "14debc6a6380c39b9a6f50aa",
    FLUTTERWAVE_BANK_CODE: process.env.FLUTTERWAVE_BANK_CODE || "044",
    FLUTTERWAVE_ACCOUNT_NUMBER: process.env.FLUTTERWAVE_ACCOUNT_NUMBER || "0690000040",
    TERMII_API_KEY: process.env.TERMII_API_KEY || "TLFVodKZXRufYhpozZbgqUshgMfFiWOHaWrqihSTSdjxbVBjRUHnCWWcEzlbXL",
    TERMII_BASE_URL: process.env.TERMII_BASE_URL || "https://api.ng.termii.com",
    CORS_ORIGINS: ((_a = process.env.CORS_ORIGINS) === null || _a === void 0 ? void 0 : _a.split(",")) || ["https://app.quicrefill.com"],
    API_DOCS_USERNAME: process.env.API_DOCS_USERNAME || "admin",
    API_DOCS_PASSWORD: process.env.API_DOCS_PASSWORD || "admin123",
    FRONTEND_URL: process.env.FRONTEND_URL || "https://app.quicrefill.com",
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    LOG_DIR: process.env.LOG_DIR || "",
    REDIS_COMMAND_TIMEOUT: process.env.REDIS_COMMAND_TIMEOUT || "10000",
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || "your_custom_webhook_secret",
    FLUTTERWAVE_WEBHOOK_SECRET: process.env.FLUTTERWAVE_WEBHOOK_SECRET || "your_flutterwave_webhook_secret"
};
logger.info("Environment variables loaded: nodeEnv=" + exports.ENV.NODE_ENV + ", apiPort=" + exports.ENV.API_PORT + ", apiHost=" + exports.ENV.API_HOST + ", corsOrigins=" + exports.ENV.CORS_ORIGINS.join(", ") + ", redisUrl=" + exports.ENV.REDIS_URL + ", webhookSecret=" + exports.ENV.WEBHOOK_SECRET + ", flutterwaveWebhookSecret=" + exports.ENV.FLUTTERWAVE_WEBHOOK_SECRET);
