# syntax=docker/dockerfile:1
# --- Base deps stage ---
FROM node:20-slim AS deps
WORKDIR /app/frontend

# Install OS deps for sharp/next if needed
RUN apt-get update && apt-get install -y --no-install-recommends libc6 libstdc++6 ca-certificates git && rm -rf /var/lib/apt/lists/*

# Only copy frontend package files to leverage Docker cache
COPY package*.json ./
RUN npm ci --omit=optional

# --- Builder stage ---
FROM node:20-slim AS builder
WORKDIR /app/frontend
COPY --from=deps /app/frontend/node_modules ./node_modules
COPY . .

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Runner stage ---
FROM node:20-slim AS runner
WORKDIR /app/frontend
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copy build artifacts
COPY --from=builder /app/frontend/.next ./.next
COPY --from=builder /app/frontend/public ./public
COPY --from=builder /app/frontend/package*.json ./
COPY --from=builder /app/frontend/node_modules ./node_modules

# Next starts on 3000 by default
ENV PORT=3000
EXPOSE 3000

USER 1001
CMD ["npm", "start"]
