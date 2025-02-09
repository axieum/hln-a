# https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# install dependencies
FROM base AS install

# ↳ install dev dependencies
RUN mkdir -p /temp/dev
COPY package.json bun.lockb /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# ↳ install prod dependencies
RUN mkdir -p /temp/prod
COPY package.json bun.lockb /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# build pre-release image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# test & build
ENV NODE_ENV=production
RUN bun test

# build production image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/src ./src
COPY --from=prerelease /usr/src/app/drizzle ./drizzle
COPY --from=prerelease /usr/src/app/drizzle.config.ts .
COPY --from=prerelease /usr/src/app/package.json .

# ↳ run the app
USER bun
ENV HLNA_CONFIG_FILE=/data/config.json5 \
    HLNA_DATABASE_URL=/data/sqlite.db \
    HLNA_LOGS_DIR=/data/logs
ENTRYPOINT [ "bun", "run", "start" ]
