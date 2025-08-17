# syntax=docker/dockerfile:1-labs
FROM node:22-bookworm
ARG GIT_TAG
LABEL org.opencontainers.image.version=$GIT_TAG

WORKDIR /app
COPY --parents pnpm-lock.yaml pnpm-workspace.yaml arona onebot external/web-scraper ./

ENV NODE_ENV=production
ENV STATIC_ROOT=/app/apps/arona/assets

RUN npm install -g pnpm@9 \
    && pnpm install --prod false --frozen-lockfile \
    && pnpm run --filter arona build

WORKDIR /app/apps/arona
CMD ["node", "./dist/main.js"]
