import express, { Request, Response, NextFunction, Application } from 'express';
import winston from 'winston';
import { rootRoutes } from './routes/root';
import { errorHandler } from './middlewares/errors';
import { ENV } from './config/env';

const logger = winston.createLogger({
  level: ENV.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: `${ENV.LOG_DIR}/customer-error.log`, level: 'error' }),
    new winston.transports.File({ filename: `${ENV.LOG_DIR}/customer-combined.log` }),
    new winston.transports.Console({ format: winston.format.simple() }),
  ],
});

logger.info('Starting Customer Service...');
logger.info(`NODE_ENV: ${ENV.NODE_ENV}`);
logger.info(`API_PORT: ${ENV.API_PORT}`);
logger.info(`API_GATEWAY_URL: ${ENV.API_GATEWAY_URL}`);

const app: Application = express();
app.use(express.json());

// Log all requests
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`Request: ${req.method} ${req.path}`);
  next();
});

// Mount root routes
app.use('/', rootRoutes);

// Debug route
app.get('/debug', (req: Request, res: Response) => {
  logger.info('Debug route hit');
  res.json({ success: true, message: 'Debug route working' });
});

// Log available routes
app.use((req: Request, res: Response, next: NextFunction) => {
  const routes = app._router.stack
    .filter((r: any) => r.route)
    .map((r: any) => `${r.route.path} [${Object.keys(r.route.methods).join(',')}]`)
    .join(', ');
  logger.info(`Available routes: ${routes}`);
  next();
});

app.use(errorHandler);

app.listen(ENV.API_PORT || 5000, ENV.API_HOST || '0.0.0.0', () => {
  logger.info(`Customer Service running on http://${ENV.API_HOST || '0.0.0.0'}:${ENV.API_PORT || 5000}/api`);
});