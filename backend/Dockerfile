# syntax=docker/dockerfile:1

# --- Base deps stage ---
FROM node:20-slim AS deps
WORKDIR /app

# Install dependencies needed for native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates git curl && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install production dependencies with optimization
RUN npm install --omit=dev --prefer-offline && npm cache clean --force

# --- Builder stage ---
FROM node:20-slim AS builder
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates git && \
    rm -rf /var/lib/apt/lists/*

# Copy dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
RUN npm install --prefer-offline

# Copy source code
COPY . .

# Compile TypeScript to JavaScript
ENV NODE_ENV=production
RUN npx tsc --project tsconfig.json

# --- Runner stage ---
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN addgroup --system --gid 1001 backend && \
    adduser --system --uid 1001 backend

# Copy production dependencies and built app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Change ownership to non-root user
RUN chown -R backend:backend /app
USER backend

# Cloud Run uses PORT env var (default 8080)
# Health check uses the PORT env variable
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

EXPOSE 8080
ENV PORT=8080

CMD ["node", "dist/server.js"]
