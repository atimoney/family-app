import path from 'node:path';
import * as dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

// Only load .env when not in production (production uses environment variables directly)
if (process.env.NODE_ENV !== 'production') {
  const envPath = path.join(import.meta.dirname, '..', '.env');
  dotenv.config({ path: envPath });
}

// DATABASE_URL comes from environment variables in production, .env in development
// For prisma generate during Docker build, we use a placeholder URL
const databaseUrl = process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

export default defineConfig({
  schema: path.join(import.meta.dirname, 'schema.prisma'),
  migrations: {
    path: path.join(import.meta.dirname, 'migrations'),
  },
  datasource: {
    url: databaseUrl,
  },
});
