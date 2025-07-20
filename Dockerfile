# syntax=docker/dockerfile:1-labs
FROM nikolaik/python-nodejs:python3.9-nodejs20
# RUN pip install yt-dlp \
#     && apt update \
#     && apt install ffmpeg -y
WORKDIR /bin
COPY --parents pnpm-lock.yaml pnpm-workspace.yaml .env arona onebot external/web-scraper ./
ENV NODE_ENV production
ENV DATABASE_URL file:/db/prod.db

RUN npm install -g pnpm@9 @sentry/cli \
    && pnpm install --prod false --frozen-lockfile \
    && pnpm run --filter arona --filter trpc-server build \
    && sentry-cli sourcemaps inject dist \
    && sentry-cli sourcemaps upload dist
