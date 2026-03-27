import { Pool } from 'pg';

const connectionString =
  process.env.ADMIN_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://galto:galto@127.0.0.1:5432/galto';

const globalForDb = globalThis as unknown as {
  galtoPool?: Pool;
};

export const db =
  globalForDb.galtoPool ??
  new Pool({
    connectionString,
    max: 10,
  });

if (!globalForDb.galtoPool) {
  globalForDb.galtoPool = db;
}
