#!/bin/sh
# Server container entrypoint: bring the database schema up to date, then start the API server.
set -e
cd /usr/brick
echo "[entrypoint] Preparing database schema..."
node docker/migrate.js
echo "[entrypoint] Starting Brick server..."
exec pnpm run start:prod
