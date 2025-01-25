set -e
pnpm install
DATABASE_URL=file:/var/lib/arona/prod.db pnpm prisma migrate deploy
docker compose up
