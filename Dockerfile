# ==============================================================================
# SANKARA EVENTS PLATFORM - PRODUCTION DOCKERFILE
# Multi-stage production build (Node 20 Alpine)
# ==============================================================================

# ── Stage 1: Build ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Enable pnpm via global npm install
RUN npm install -g pnpm@10

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy repository config & workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Copy all source directories
COPY lib ./lib
COPY artifacts ./artifacts
COPY scripts ./scripts

# Install dependencies using frozen lockfile
RUN pnpm install --frozen-lockfile

# Build all libraries, frontend SPA, and API server bundle
RUN pnpm run build

# ── Stage 2: Production Runner ────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Setup non-root security user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser

# Copy package structures and built artifacts
COPY --from=builder --chown=nodeuser:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodeuser:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=nodeuser:nodejs /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/lib ./lib
COPY --from=builder --chown=nodeuser:nodejs /app/artifacts ./artifacts

# Create uploads directory with appropriate ownership
RUN mkdir -p /app/uploads && chown -R nodeuser:nodejs /app/uploads

USER nodeuser

EXPOSE 5000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/dashboard/stats || exit 0

# Start compiled production server (Serves both API and Vite React SPA frontend)
CMD ["node", "artifacts/api-server/dist/index.mjs"]
