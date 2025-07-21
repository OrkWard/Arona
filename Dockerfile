# syntax=docker/dockerfile:1-labs
FROM node:22-bookworm
WORKDIR /bin
COPY --parents pnpm-lock.yaml pnpm-workspace.yaml .env arona onebot external/web-scraper ./
ENV NODE_ENV production
ENV DATABASE_URL file:/db/prod.db

RUN npm install -g pnpm@9 @sentry/cli \
    && pnpm install --prod false --frozen-lockfile \
    && pnpm run --filter arona --filter trpc-server build \
    && sentry-cli sourcemaps inject arona/dist \
    && sentry-cli sourcemaps upload arona/dist
