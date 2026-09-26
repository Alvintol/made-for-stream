# syntax=docker/dockerfile:1

# ---- deps: install production dependencies only, in their own layer ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime: minimal image, no build tools, no dev dependencies ----
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Non-root user. Alpine's node image ships a "node" user already; reuse it
# instead of adding a new one.
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
# Every top-level module server.js imports. A glob, not a list: the list
# went stale when Sprint 4-9 added modules, and the image crashed on start.
COPY --chown=node:node *.js ./

USER node

# Cloud Run injects PORT at runtime; 8787 matches api/.env.example for any
# platform that doesn't.
ENV PORT=8787
EXPOSE 8787

# Self-contained check: no curl/wget in alpine, so use Node's built-in
# fetch. Mirrors GET /api/health (server.js) -- fails the container if the
# process is up but not actually serving.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
