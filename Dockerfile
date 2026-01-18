# syntax=docker/dockerfile:1-labs
FROM node:22-bookworm
ARG GIT_TAG
LABEL org.opencontainers.image.version=$GIT_TAG
LABEL org.opencontainers.image.source="https://github.com/OrkWard/Arona"

WORKDIR /app
COPY --parents pnpm-lock.yaml pnpm-workspace.yaml package.json \
    apps/arona/package.json \
    packages/onebot/package.json \
    packages/wormface-openapi/package.json \
    ./
RUN npm install -g pnpm@9 \
    && pnpm install --prod false --frozen-lockfile

COPY . .
RUN pnpm --filter arona run build

ENV NODE_ENV=production
ENV STATIC_ROOT=/app/apps/arona/assets

WORKDIR /app/apps/arona
CMD ["npm", "run", "strat"]
