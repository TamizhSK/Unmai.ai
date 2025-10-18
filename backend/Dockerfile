# syntax=docker/dockerfile:1

# --- Base deps stage ---
FROM node:20-slim AS deps
WORKDIR /app

# Install dependencies needed for native modules
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates git && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install production dependencies only (no lockfile required)
RUN npm install --omit=dev && npm cache clean --force

# --- Builder stage ---
FROM node:20-slim AS builder
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates git && rm -rf /var/lib/apt/lists/*

# Copy dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
RUN npm install

COPY . .

# Build TypeScript to JavaScript
ENV NODE_ENV=production
RUN npm run build

# --- Runner stage ---
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 backend
RUN adduser --system --uid 1001 backend

# Copy production dependencies and built app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Change ownership to non-root user
RUN chown -R backend:backend /app
USER backend

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

EXPOSE 3001
ENV PORT=3001

CMD ["node", "dist/server.js"]
