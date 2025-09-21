# syntax=docker/dockerfile:1
# --- Base deps stage ---
FROM node:20-slim AS deps
WORKDIR /app

# Install OS deps for sharp/next if needed
RUN apt-get update && apt-get install -y --no-install-recommends libc6 libstdc++6 ca-certificates git && rm -rf /var/lib/apt/lists/*

# Copy root package.json and lockfile for workspace
COPY package*.json ./
# Copy frontend package.json
COPY frontend/package*.json ./frontend/
RUN npm ci --workspace=frontend --omit=optional

# --- Builder stage ---
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./
COPY frontend/ ./frontend/

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
WORKDIR /app/frontend
RUN npm run build

# --- Runner stage ---
FROM node:20-slim AS runner
WORKDIR /app/frontend
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copy build artifacts for standalone mode
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./.next/static
COPY --from=builder /app/frontend/public ./public

# Next starts on 3000 by default
ENV PORT=3000
EXPOSE 3000

USER 1001
CMD ["node", "server.js"]
