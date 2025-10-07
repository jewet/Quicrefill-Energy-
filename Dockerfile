# Stage 1: Build
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies (Alpine uses apk instead of apt-get)
RUN apk update && apk add --no-cache python3 make g++ && rm -rf /var/cache/apk/*

# Update npm to meet package.json requirement (>=11.3.0)
RUN npm install -g npm@11.4.2

# Set npm registry explicitly
RUN npm config set registry https://registry.npmjs.org/

# Create non-root user and group for build stage
RUN addgroup -S appgroup && adduser -S -G appgroup -u 1001 appuser

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build) and update to latest secure versions
RUN npm ci && npm update && npm cache clean --force

# Copy source code and configuration files
COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts
COPY sql ./sql
COPY tsconfig.json ./
COPY generate-swagger.ts ./
COPY .env .env.customer ./

# Set permissions for logs directory
RUN mkdir -p /app/logs && chown -R appuser:appgroup /app && chmod -R 775 /app/logs

# Switch to non-root user for build steps
USER appuser

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript code
RUN npm run build

# Generate Swagger JSON with error logging
RUN npm run generate-swagger || { echo "Swagger generation failed"; cat /app/logs/*.log 2>/dev/null; exit 1; }

# Stage 2: Runtime
FROM node:22-alpine

# Install runtime dependencies (including bash for CMD and postgresql15-client for Alpine)
RUN apk update && apk add --no-cache curl bash postgresql15-client redis && rm -rf /var/cache/apk/*

# Update npm in runtime stage
RUN npm install -g npm@11.4.2

# Set npm registry explicitly
RUN npm config set registry https://registry.npmjs.org/

# Create non-root user and group
RUN addgroup -S appgroup && adduser -S -G appgroup -u 1001 appuser

# Set working directory
WORKDIR /app

# Copy built artifacts from builder stage
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma
COPY --from=builder --chown=appuser:appgroup /app/package.json ./package.json
COPY --from=builder --chown=appuser:appgroup /app/sql ./sql
COPY --from=builder --chown=appuser:appgroup /app/scripts ./scripts
COPY --from=builder --chown=appuser:appgroup /app/swagger.json ./swagger.json
COPY --from=builder --chown=appuser:appgroup /app/.env* ./
COPY --from=builder --chown=appuser:appgroup /app/logs ./logs

# Set ownership and permissions
RUN chown -R appuser:appgroup /app && \
    chmod -R 775 /app/logs && \
    chmod 644 /app/.env*

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5000

# Environment variables
ENV NODE_ENV=production \
    LOG_DIR=/app/logs \
    API_GATEWAY_URL=https://api.quicrefill.com

# Healthcheck with extended start period for dependency initialization
HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=5 \
    CMD curl -f http://localhost:5000/health || exit 1

# Start the application
CMD ["/bin/bash", "-c", "/app/scripts/run-migrations.sh && node dist/index.js"]