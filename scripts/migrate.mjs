import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

await loadLocalEnv();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL nao esta configurada. Copie .env.example para .env.local e preencha a URL do Neon.");
  process.exit(1);
}

const sql = neon(connectionString);
const schemaPath = join(process.cwd(), "database", "schema.sql");
const schema = await readFile(schemaPath, "utf8");

for (const statement of schema.split(/;\s*(?:\r?\n|$)/g)) {
  const trimmed = statement.trim();
  if (trimmed.length > 0) {
    await sql.query(`${trimmed};`);
  }
}

console.log("Schema do StreamMode aplicado no Neon.");

async function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    try {
      const file = await readFile(join(process.cwd(), fileName), "utf8");
      for (const line of file.split(/\r?\n/g)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
          continue;
        }

        const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!match) {
          continue;
        }

        const [, key, rawValue] = match;
        if (process.env[key]) {
          continue;
        }

        process.env[key] = rawValue.replace(/^["']|["']$/g, "");
      }
    } catch {
      continue;
    }
  }
}
