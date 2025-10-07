import swaggerJSDoc, { SwaggerDefinition, Options } from 'swagger-jsdoc';
import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';
import { ENV } from './src/config/env';
import { logger } from './src/utils/loggers';

const baseDir = path.resolve(__dirname);
const outputPath = path.resolve(baseDir, 'swagger.json');

const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Quicrefill Customer Service API',
    version: '1.0.0',
    description: 'API documentation for Quicrefill Customer Service, managing accounts and authentication',
    contact: { name: 'Quicrefill Support', email: 'support@quicrefill.com' },
  },
  servers: [
    {
      url:
        ENV.NODE_ENV === 'production'
          ? 'https://api.quicrefill.com/api/customer'
          : `${ENV.API_GATEWAY_URL || 'http://localhost:4000'}/api/customer`,
      description: ENV.NODE_ENV === 'production' ? 'Production server via API Gateway' : 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  paths: {},
};

const swaggerOptions: Options = {
  failOnErrors: false,
  definition: swaggerDefinition,
  apis: [path.join(baseDir, 'src/routes/**/*.ts')],
};

const validateApis = (apis: readonly string[]): string[] => {
  const validFiles: string[] = [];
  if (!apis || apis.length === 0) {
    logger.warn('No API paths provided for Swagger parsing');
    return validFiles;
  }

  logger.info('Base directory:', { baseDir });
  logger.info('API patterns:', { apis });

  apis.forEach((pattern) => {
    try {
      const files = globSync(pattern, { absolute: true, nodir: true });
      if (files.length === 0) {
        logger.warn(`No files found for pattern: ${pattern}`);
        return;
      }
      logger.info(`Found ${files.length} files for pattern ${pattern}`, { files });

      files.forEach((file: string) => {
        try {
          if (!file.endsWith('.ts') && !file.endsWith('.js')) {
            logger.warn(`Skipping non-TypeScript/JavaScript file: ${file}`);
            return;
          }

          fs.accessSync(file, fs.constants.R_OK);
          const content = fs.readFileSync(file, 'utf8');
          if (!content.trim()) {
            logger.warn(`File ${file} is empty`);
            return;
          }

          // Skip files with TypeScript-specific syntax or problematic patterns, but allow smsSetting.ts to test JSDoc
          if (
            !file.includes('smsSetting.ts') && // Allow smsSetting.ts to be processed
            (content.includes('import type') ||
              content.includes('export type') ||
              content.includes('declare ') ||
              content.includes('interface ') ||
              content.includes('.bind(') ||
              content.includes('static '))
          ) {
            logger.warn(`File ${file} contains TypeScript-specific syntax or problematic patterns (e.g., .bind, static). Skipping.`);
            return;
          }

          if (!content.includes('@swagger') && !content.includes('@openapi')) {
            logger.warn(`File ${file} lacks Swagger annotations, but including for processing`);
          }

          validFiles.push(file);
        } catch (error) {
          logger.error(`Error reading or validating file ${file}`, { error: error as Error, stack: (error as Error).stack });
        }
      });
    } catch (error) {
      logger.error(`Error processing pattern ${pattern}`, { error: error as Error, stack: (error as Error).stack });
    }
  });

  return validFiles;
};

const processFilesIndividually = async (files: string[]): Promise<SwaggerDefinition> => {
  let combinedSpec: SwaggerDefinition = { ...swaggerDefinition, paths: {} };

  for (const file of files) {
    logger.info(`Processing file: ${file}`);
    try {
      const tempOptions: Options = {
        ...swaggerOptions,
        apis: [file],
      };
      const spec = swaggerJSDoc(tempOptions) as SwaggerDefinition;
      if (spec.paths) {
        combinedSpec.paths = { ...combinedSpec.paths, ...(spec.paths || {}) };
      }
      logger.debug(`Processing file ${file} completed with paths:`, { paths: Object.keys(spec.paths || {}) });
    } catch (error) {
      logger.error(`Error processing file ${file}`, {
        error: error as Error,
        stack: (error as Error).stack,
        fileContent: fs.readFileSync(file, 'utf8').substring(0, 500),
      });
    }
  }

  return combinedSpec;
};

async function generateSwagger() {
  try {
    logger.info('Starting Swagger generation...');
    const apis = swaggerOptions.apis ?? [];
    if (apis.length === 0) {
      logger.error('Swagger options APIs array is undefined or empty');
      process.exit(1);
    }

    const validApiFiles = validateApis(apis);
    if (validApiFiles.length === 0) {
      logger.warn('No valid API files found; generating empty Swagger spec');
      const swaggerSpec = swaggerJSDoc({ ...swaggerOptions, apis: [] });
      fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2), 'utf8');
      logger.info(`Empty Swagger JSON generated at ${outputPath}`);
      return;
    }

    logger.info('Valid API files:', { validApiFiles });
    logger.info('Generating Swagger specification...');
    const swaggerSpec = await processFilesIndividually(validApiFiles);

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      logger.info(`Created output directory: ${outputDir}`);
    }
    try {
      fs.accessSync(outputDir, fs.constants.W_OK);
    } catch (error) {
      logger.error(`No write permission for output directory ${outputDir}`, { error: error as Error, stack: (error as Error).stack });
      process.exit(1);
    }
    logger.info(`Writing Swagger JSON to ${outputPath}`);

    fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2), 'utf8');
    logger.info(`Swagger JSON generated successfully at ${outputPath}`);

    if (fs.existsSync(outputPath)) {
      logger.info(`Confirmed: swagger.json exists at ${outputPath}`);
    } else {
      logger.error(`Failed to confirm existence of swagger.json at ${outputPath}`);
      process.exit(1);
    }
  } catch (error) {
    logger.error('Failed to generate Swagger JSON', { error: error as Error, stack: (error as Error).stack });
    logger.error('Processed API files:', { apis: swaggerOptions.apis });
    process.exit(1);
  }
}

let isExiting = false; // Prevent multiple beforeExit calls
process.on('beforeExit', async () => {
  if (isExiting) {
    console.log('BeforeExit already triggered, skipping');
    return;
  }
  isExiting = true;
  try {
    console.log('Process exiting, closing logger transports');
    await logger.end();
  } catch (error) {
    console.error('Error closing logger:', error);
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

try {
  require.resolve('swagger-jsdoc');
  require.resolve('glob');
  require.resolve('winston');
  require.resolve('dotenv');
} catch (error) {
  console.error('Required dependency missing:', error as Error);
  process.exit(1);
}

generateSwagger();