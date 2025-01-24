FROM node:20
WORKDIR /app
COPY . .
ENV DATABASE_URL "file:/store/product.db"
RUN corepack enable \
    && pnpm install --frozen-lockfile --only=production \
    && pnpm prisma migrate deploy \
    && pnpm run build

CMD ["node", "./dist/db-worker.js"]
