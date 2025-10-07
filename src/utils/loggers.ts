import winston from 'winston';
import fs from 'fs';
import path from 'path';

export const captureLogs = (logMessage: { message: string; error: string; stack: string; timestamp: string }) => {
  console.log('Logging error:', logMessage);
};

export class Logger {
  private logger: winston.Logger;
  private isClosed: boolean = false;
  private static instance: Logger | null = null;

  private constructor(context: string) {
    const logDir = process.env.LOG_DIR ? path.resolve(process.env.LOG_DIR) : path.resolve('app', 'logs');
    if (!fs.existsSync(logDir)) {
      try {
        fs.mkdirSync(logDir, { recursive: true });
        console.log(`Created log directory: ${logDir}`);
      } catch (err: unknown) {
        console.error(`Failed to create log directory ${logDir}:`, err);
        process.exit(1);
      }
    }

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'customer-service', context },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
        new winston.transports.File({
          filename: path.join(logDir, 'customer-service.log'),
          handleExceptions: false, // Disable default exception handling
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          tailable: true,
        }),
      ],
      exceptionHandlers: [], // Disable Winston's default uncaught exception logging
    });
  }

  public static getLogger(context: string = 'default'): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(context);
    }
    Logger.instance.logger.defaultMeta = { ...Logger.instance.logger.defaultMeta, context };
    return Logger.instance;
  }

  info(message: string, meta?: any): void {
    if (!this.isClosed) {
      this.logger.info(message, meta);
    } else {
      console.log(`[INFO] ${message}`, meta);
    }
  }

  error(message: string, meta?: any): void {
    if (!this.isClosed) {
      this.logger.error(message, meta);
    } else {
      console.error(`[ERROR] ${message}`, meta);
    }
  }

  warn(message: string, meta?: any): void {
    if (!this.isClosed) {
      this.logger.warn(message, meta);
    } else {
      console.warn(`[WARN] ${message}`, meta);
    }
  }

  debug(message: string, meta?: any): void {
    if (!this.isClosed) {
      this.logger.debug(message, meta);
    } else {
      console.log(`[DEBUG] ${message}`, meta);
    }
  }

  async end(): Promise<void> {
    if (this.isClosed) {
      console.log('Logger already closed');
      return Promise.resolve();
    }

    this.isClosed = true;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn('Logger closure timed out');
        resolve();
      }, 5000); // 5-second timeout

      let pendingTransports = this.logger.transports.length;

      if (pendingTransports === 0) {
        console.log('No transports to close');
        clearTimeout(timeout);
        resolve();
        return;
      }

      this.logger.on('finish', () => {
        clearTimeout(timeout);
        console.log('Logger fully flushed');
        resolve();
      });

      this.logger.transports.forEach((transport) => {
        if ('close' in transport && typeof transport.close === 'function') {
          transport.once('finish', () => {
            pendingTransports--;
            if (pendingTransports === 0) {
              console.log('All logger transports closed');
              clearTimeout(timeout);
              resolve();
            }
          });
          transport.once('error', (err) => {
            console.error('Error closing transport:', err);
            clearTimeout(timeout);
            reject(err);
          });
          transport.close();
        } else {
          pendingTransports--;
          if (pendingTransports === 0) {
            console.log('All logger transports closed');
            clearTimeout(timeout);
            resolve();
          }
        }
      });

      this.logger.end();
    });
  }
}

export const logger = Logger.getLogger('Config');
export default Logger;