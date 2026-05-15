import { neon } from "@neondatabase/serverless";

type SqlClient = ReturnType<typeof neon>;

let cachedSql: SqlClient | null = null;

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export function getSql() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL nao esta configurada.");
  }

  if (!cachedSql) {
    cachedSql = neon(connectionString);
  }

  return cachedSql;
}

export function getAppBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}
