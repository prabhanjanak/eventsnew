import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import * as schema from "./schema/index.js";

const { Pool } = pg;

// Load root .env file if DATABASE_URL is not set
if (!process.env.DATABASE_URL) {
  const dirname = import.meta.dirname || path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(dirname, "../../../.env");
  if (fs.existsSync(envPath)) {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(envPath);
    } else {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...values] = trimmed.split('=');
          if (key) {
            process.env[key.trim()] = values.join('=').trim();
          }
        }
      });
    }
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
export const db = drizzle(pool, { schema });

export * from "./schema/index.js";
