# syntax=docker/dockerfile:1-labs
FROM nikolaik/python-nodejs:python3.9-nodejs20
RUN pip install yt-dlp \
    && apt update \
    && apt install ffmpeg -y
WORKDIR /arona
COPY --parents pnpm-lock.yaml pnpm-workspace.yaml arona onebot external/web-scraper ./
ENV NODE_ENV production
ENV DATABASE_URL file:/db/prod.db

RUN npm install -g pnpm@9 \
    && pnpm install --prod false --frozen-lockfile \
    && pnpm run --filter arona --filter trpc-server build
