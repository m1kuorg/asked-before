# Asked Before in one container (m1kuorg/basics#40, Operations): the one Bun
# process, serving the pages, the API, and its sorts, with its SQLite file
# on a volume at /data. The README's "Self-host it" says how to run it.

FROM oven/bun:1.4.3-slim

WORKDIR /app

# The dependencies first, so a change to the code doesn't install them again.
COPY package.json bun.lock tsconfig.json ./
COPY packages/sdk/package.json packages/sdk/
COPY packages/mcp/package.json packages/mcp/
RUN bun install --frozen-lockfile --production

# Only what the server runs and builds its pages from (see .dockerignore).
COPY . .

# The database lives on the volume, owned by the image's bun user, who runs the app.
RUN mkdir -p /data && chown bun:bun /data
VOLUME /data
ENV PORT=3000 DATABASE_PATH=/data/asked-before.sqlite
USER bun
EXPOSE 3000

# Bun itself asks the health endpoint, since the image has no curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --start-interval=1s --retries=3 \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/api/v1/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["bun", "server.ts"]
