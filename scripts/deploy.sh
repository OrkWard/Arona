set -e
pnpm install
DATABASE_URl=/var/lib/arona/prod.db pnpm prisma migrate deploy
docker compose up
