"use strict";
exports.__esModule = true;
exports.logger = exports.Logger = exports.captureLogs = void 0;
var winston_1 = require("winston");
var fs_1 = require("fs");
var path_1 = require("path");
exports.captureLogs = function (logMessage) {
    console.log('Logging error:', logMessage);
};
var Logger = /** @class */ (function () {
    function Logger(context) {
        var logDir = process.env.LOG_DIR ? path_1["default"].resolve(process.env.LOG_DIR) : path_1["default"].resolve('logs');
        if (!fs_1["default"].existsSync(logDir)) {
            try {
                fs_1["default"].mkdirSync(logDir, { recursive: true });
                console.log("Created log directory: " + logDir);
            }
            catch (err) {
                console.error("Failed to create log directory " + logDir + ":", err);
            }
        }
        this.logger = winston_1["default"].createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston_1["default"].format.combine(winston_1["default"].format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1["default"].format.errors({ stack: true }), winston_1["default"].format.json()),
            defaultMeta: { service: 'customer-service', context: context },
            transports: [
                new winston_1["default"].transports.Console({
                    format: winston_1["default"].format.combine(winston_1["default"].format.colorize(), winston_1["default"].format.simple())
                }),
                new winston_1["default"].transports.File({
                    filename: path_1["default"].join(logDir, 'customer-service.log')
                }),
            ]
        });
    }
    Logger.prototype.info = function (message, meta) {
        this.logger.info(message, meta);
    };
    Logger.prototype.error = function (message, meta) {
        this.logger.error(message, meta);
    };
    Logger.prototype.warn = function (message, meta) {
        this.logger.warn(message, meta);
    };
    Logger.prototype.debug = function (message, meta) {
        this.logger.debug(message, meta);
    };
    return Logger;
}());
exports.Logger = Logger;
// Export singleton logger instance for wallet context
exports.logger = new Logger('wallet');
// Export Logger class for custom instances if needed
exports["default"] = Logger;
