import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "./index.js";
const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "schema.sql"), "utf8");
await pool.query(sql);
console.log("migrated");
await pool.end();
