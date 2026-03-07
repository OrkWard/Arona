# syntax=docker/dockerfile:1-labs

# builder
FROM node:22-bookworm AS builder

WORKDIR /app
COPY --parents pnpm-lock.yaml pnpm-workspace.yaml package.json \
    apps/arona/package.json \
    packages/onebot/package.json \
    packages/wormface-openapi/package.json \
    ./
RUN npm install -g pnpm@9 \
    && pnpm install --prod false --frozen-lockfile

COPY . .
RUN pnpm --filter arona run build \
    && pnpm --filter arona --prod deploy /app/pruned

# prod
FROM node:22-bookworm-slim
ARG GIT_TAG
LABEL org.opencontainers.image.version=$GIT_TAG
LABEL org.opencontainers.image.source="https://github.com/OrkWard/Arona"

WORKDIR /app
COPY --from=builder /app/pruned .

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
