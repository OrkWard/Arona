# syntax=docker/dockerfile:1-labs

# builder
FROM node:22-bookworm@sha256:80fdb3f57c815e1b638d221f30a826823467c4a56c8f6a8d7aa091cd9b1675ea AS builder

WORKDIR /app
COPY --parents pnpm-lock.yaml pnpm-workspace.yaml package.json \
    apps/arona/package.json \
    packages/onebot/package.json \
    ./

RUN npm config set registry https://registry.npmmirror.com \
    && npm install -g pnpm@9 \
    && pnpm install --prod false --frozen-lockfile

COPY . .
RUN pnpm --filter arona run build \
    && pnpm --filter arona --prod deploy /app/pruned

# prod
FROM node:22-bookworm-slim
LABEL org.opencontainers.image.source="https://github.com/OrkWard/Arona"

WORKDIR /app
COPY --from=builder /app/pruned .

ENV NODE_ENV=production

CMD ["npm", "run", "start"]
