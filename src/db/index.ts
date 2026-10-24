import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as schema from './schema.ts';

dotenv.config();

declare global {
  var _postgresPool: Pool | undefined;
}

export function isExternalDatabaseUrlReady(rawUrl?: string): boolean {
  if (!rawUrl) return false;
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith('postgres://') && !trimmed.startsWith('postgresql://')) {
    return false;
  }
  if (trimmed.includes('[YOUR-PASSWORD]') || trimmed.includes('<YOUR-PASSWORD>')) {
    return false;
  }
  return true;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const rawCandidates = [
      process.env.DATABASE_URL,
      process.env.SUPABASE_DATABASE_URL,
      process.env.SUPABASE_URL,
      process.env.POSTGRES_URL,
    ];
    const dbUrl = rawCandidates.find(isExternalDatabaseUrlReady);
    if (dbUrl) {
      const cleanConnString = dbUrl.replace(/\?pgbouncer=true/i, '');
      console.log('Connecting to PostgreSQL using external connection string.');
      global._postgresPool = new Pool({
        connectionString: cleanConnString,
        ssl: { rejectUnauthorized: false },
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    } else {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    }

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
export { pool };
