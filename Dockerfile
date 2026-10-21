ARG BUN_VERSION=1.4.2
FROM oven/bun:${BUN_VERSION}-alpine AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN bun run check && bun test tests && bun run build

FROM oven/bun:${BUN_VERSION}-alpine AS production-dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:${BUN_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/data/green-light.sqlite BUN_RUNTIME_TRANSPILER_CACHE_PATH=/tmp/bun-cache
COPY --from=production-dependencies --chown=bun:bun /app/node_modules ./node_modules
COPY --from=build --chown=bun:bun /app/dist ./dist
COPY --from=build --chown=bun:bun /app/server ./server
COPY --from=build --chown=bun:bun /app/shared ./shared
COPY --chown=bun:bun package.json bun.lock ./
RUN mkdir -p /data && chown bun:bun /data
USER bun
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD bun -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["bun", "server/index.ts"]
