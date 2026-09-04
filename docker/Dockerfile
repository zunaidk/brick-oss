# syntax=docker/dockerfile:1
# Multi-target image for self-hosting Brick.
#   --target server  : API server + built app client and public-page renderer (default)
#   --target landing : Next.js marketing site
# Used by docker-compose.yml at the repo root.

ARG NODE_VERSION=16

# ---- dependencies ------------------------------------------------------------
FROM node:${NODE_VERSION}-bullseye AS deps
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PUPPETEER_SKIP_DOWNLOAD=1 \
    CI=true
RUN corepack enable && corepack prepare pnpm@8.14.0 --activate
WORKDIR /usr/brick
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY overrides ./overrides
COPY apps/client/package.json apps/client/
COPY apps/landing/package.json apps/landing/
COPY apps/public-client/package.json apps/public-client/
COPY apps/server/package.json apps/server/
COPY apps/shared/package.json apps/shared/
COPY shared/lib/package.json shared/lib/
COPY shared/misc/package.json shared/misc/
COPY shared/themes/package.json shared/themes/
RUN pnpm install --frozen-lockfile

# ---- sources + public build-time config ---------------------------------------
FROM deps AS src
COPY . .
# PUBLICVAR_* values are embedded into the frontend bundles at build time
ARG PUBLICVAR_BRICK_HOST
ARG PUBLICVAR_BRICK_DOMAIN
ARG PUBLICVAR_BRICK_URL
ARG PUBLICVAR_BRICK_CLIENT_BANNER=
ARG PUBLICVAR_EXTERNAL_TLS_TERMINATION=true
ARG PUBLICVAR_ALLOW_SIGNUP=true
ENV PUBLICVAR_BRICK_HOST=${PUBLICVAR_BRICK_HOST} \
    PUBLICVAR_BRICK_DOMAIN=${PUBLICVAR_BRICK_DOMAIN} \
    PUBLICVAR_BRICK_URL=${PUBLICVAR_BRICK_URL} \
    PUBLICVAR_BRICK_CLIENT_BANNER=${PUBLICVAR_BRICK_CLIENT_BANNER} \
    PUBLICVAR_EXTERNAL_TLS_TERMINATION=${PUBLICVAR_EXTERNAL_TLS_TERMINATION} \
    PUBLICVAR_ALLOW_SIGNUP=${PUBLICVAR_ALLOW_SIGNUP} \
    NODE_OPTIONS=--max-old-space-size=4096

# ---- server ------------------------------------------------------------------
FROM src AS server-build
RUN pnpm exec turbo build --filter=@brick/server --filter=@brick/client --filter=@brick/public-client

FROM server-build AS server
ENV NODE_ENV=production
EXPOSE 3000 3001 3002
ENTRYPOINT ["sh", "docker/entrypoint.sh"]

# ---- landing -----------------------------------------------------------------
FROM src AS landing-build
RUN pnpm exec turbo build --filter=@brick/landing

FROM landing-build AS landing
ENV NODE_ENV=production
EXPOSE 4001
CMD ["pnpm", "run", "start:landing:prod"]
