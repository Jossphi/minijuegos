import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  const client = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: true } });
  await client.connect();
  await client.query(readFileSync(join(__dirname, "..", "db", "schema.sql"), "utf8"));
  await client.end();
  console.log("✅ Esquema aplicado");
}
main().catch((e) => { console.error(e); process.exit(1); });
