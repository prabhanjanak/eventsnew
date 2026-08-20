import { defineConfig } from "drizzle-kit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Load root .env file if DATABASE_URL is not set
if (!process.env.DATABASE_URL) {
  const dirname = import.meta.dirname || path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(dirname, "../../.env");
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
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
