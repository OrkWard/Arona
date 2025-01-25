FROM node:20
WORKDIR /app
COPY . .
ENV DATABASE_URL "file:/store/prod.db"
ENV NODE_ENV "prod"
RUN corepack enable \
    && pnpm install --frozen-lockfile --only=production \
    && pnpm prisma generate \
    && pnpm run build

CMD ["node", "./dist/db-worker.js"]
