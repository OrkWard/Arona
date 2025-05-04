# syntax=docker/dockerfile:1-labs
FROM nikolaik/python-nodejs:python3.9-nodejs20
RUN pip install yt-dlp \
    && apt install ffmpeg
WORKDIR /arona
COPY --parents pnpm-lock.yaml pnpm-workspace.yaml apps packages infra external packages ./
ENV NODE_ENV production
ENV DATABASE_URL file:/db/prod.db

RUN npm install -g pnpm@9 \
    && pnpm install --prod false --frozen-lockfile \
    && pnpm run --filter backup --filter subscribe --filter trpc-server build
