import { createLogger, format, transports } from "winston";

const logger = createLogger({
  level: "info", // Adjust logging level as needed (e.g., 'debug', 'warn', 'error')
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }), // Include stack trace in error logs
    format.splat(), // Support for string interpolation
    format.json() // Log in JSON format for structured logging
  ),
  transports: [
    new transports.Console(), // Log to the console
    new transports.File({ filename: "logs/error.log", level: "error" }), // Log errors to file
    new transports.File({ filename: "logs/combined.log" }) // Log all messages to file
  ],
  exitOnError: false, // Prevent winston from exiting after logging an error
});

export default logger;
