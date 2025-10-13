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

# Create dist directory and tsx launcher
ENV NODE_ENV=production
ENV GENERATE_SOURCEMAP=false
RUN mkdir -p dist

# Compile TypeScript to JavaScript
RUN npx tsc --project tsconfig.json --declaration false --sourceMap false

# Create a simple server launcher
RUN echo '#!/usr/bin/env node\n\
import("./server.js").catch(console.error);' > dist/index.js

# Make it executable
RUN chmod +x dist/server.js

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
COPY --from=builder /app/src ./src

# Change ownership to non-root user
RUN chown -R backend:backend /app
USER backend

# Health check with timeout
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

EXPOSE 3001
ENV PORT=3001

CMD ["node", "dist/index.js"]
