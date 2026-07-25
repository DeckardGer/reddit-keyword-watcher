FROM oven/bun:1-slim

WORKDIR /app
COPY package.json tsconfig.json ./
COPY src ./src

# No runtime dependencies; devDependencies are only for typecheck/test.
ENV DB_PATH=/app/data/watcher.db
VOLUME /app/data

CMD ["bun", "run", "src/index.ts"]
