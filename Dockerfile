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
COPY --from=prerelease /usr/src/app/drizzle .
COPY --from=prerelease /usr/src/app/drizzle.config.ts .
COPY --from=prerelease /usr/src/app/package.json .
COPY --from=prerelease /usr/src/app/src .

# ↳ run the app
USER bun
ENTRYPOINT [ "bun", "run", "start" ]
