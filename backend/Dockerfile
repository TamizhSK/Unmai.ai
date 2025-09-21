# syntax=docker/dockerfile:1
# --- Base deps stage ---
FROM node:20-slim AS deps
WORKDIR /app/backend

RUN apt-get update && apt-get install -y --no-install-recommends libc6 libstdc++6 ca-certificates git && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm ci --omit=optional

# --- Builder stage ---
FROM node:20-slim AS builder
WORKDIR /app/backend
COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend .

ENV NODE_ENV=production
RUN npm run build

# --- Runner stage ---
FROM node:20-slim AS runner
WORKDIR /app/backend
ENV NODE_ENV=production

# Copy minimal runtime files
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/package*.json ./
COPY --from=deps /app/backend/node_modules ./node_modules

# Health and listen port
ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/server.js"]
