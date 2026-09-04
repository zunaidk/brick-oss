'use strict'

// Database bootstrap for self-hosted Brick.
//
// The migrations in apps/server/apps/brick/src/migrations are incremental (they assume the
// original tables already exist), so on an EMPTY database we create the schema from the
// TypeORM entities and mark every migration as applied. On an existing database we just run
// the pending migrations. Uses the compiled server output, so run it after `turbo build -F server`.

require('reflect-metadata')
const path = require('path')
const { createConnection } = require('typeorm')

const serverDir = path.resolve(__dirname, '../apps/server')
const dbConfig = require(path.join(serverDir, 'dist/libs/db/src/database.config')).default

async function main() {
  const connection = await createConnection({
    ...dbConfig,
    logging: ['error', 'warn', 'migration', 'schema'],
  })
  try {
    const queryRunner = connection.createQueryRunner()
    const hasUsersTable = await queryRunner.hasTable('users')
    const hasMigrationsTable = await queryRunner.hasTable('migrations')
    await queryRunner.release()

    if (!hasUsersTable && !hasMigrationsTable) {
      console.log('[migrate] Empty database detected: creating schema from entities')
      await connection.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
      await connection.synchronize()
      // Creates the migrations table without running anything
      await connection.showMigrations()
      for (const migration of connection.migrations) {
        const name = migration.name || migration.constructor.name
        const timestamp = parseInt(name.substr(-13), 10)
        await connection.query('INSERT INTO "migrations"("timestamp", "name") VALUES ($1, $2)', [
          timestamp,
          name,
        ])
      }
      console.log(`[migrate] Schema created, ${connection.migrations.length} migrations marked as applied`)
    } else {
      const ran = await connection.runMigrations({ transaction: 'each' })
      console.log(`[migrate] Ran ${ran.length} pending migration(s)`)
    }

    if (process.env.SELF_HOSTED_PLAN === 'true') {
      const res = await connection.query(
        `UPDATE "users" SET "subscriptionPlan" = 'self_hosted' WHERE "subscriptionPlan" = 'free'`,
      )
      console.log(`[migrate] SELF_HOSTED_PLAN: moved ${res[1] ?? 0} user(s) from free to self_hosted`)
    }
  } finally {
    await connection.close()
  }
}

main().catch(err => {
  console.error('[migrate] Failed:', err)
  process.exit(1)
})
