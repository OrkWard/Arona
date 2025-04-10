# syntax=docker/dockerfile:1-labs
FROM node:20
WORKDIR /arona
COPY --parents pnpm-lock.yaml pnpm-workspace.yaml apps packages infra external packages ./
ENV NODE_ENV production
ENV DATABASE_URL file:/db/prod.db

RUN npm install -g pnpm@9 \
    && pnpm install --prod false --frozen-lockfile \
    && pnpm run --filter backup --filter subscribe build
