import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

let db: DatabaseSync | null = null;

export function getOutboundSqlite(): DatabaseSync {
  if (db) return db;

  const path = process.env.OUTBOUND_SQLITE_PATH ?? join(process.cwd(), "outbound-engine", "outbound.db");
  db = new DatabaseSync(path);
  initSchema(db);
  return db;
}

function initSchema(database: DatabaseSync) {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(process.cwd(), "outbound-engine", "sqlite-schema.sql"),
    join(process.cwd(), "mission-control", "outbound-engine", "sqlite-schema.sql"),
    join(here, "../../../../outbound-engine/sqlite-schema.sql"),
  ];

  const schemaPath = candidates.find((p) => existsSync(p));
  if (!schemaPath) {
    throw new Error(`sqlite schema not found. checked: ${candidates.join(", ")}`);
  }

  const sql = readFileSync(schemaPath, "utf8");
  database.exec(sql);
}
