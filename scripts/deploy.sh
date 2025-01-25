set -e
pnpm install
DATABASE_URL=/var/lib/arona/prod.db pnpm prisma migrate deploy
docker compose up
