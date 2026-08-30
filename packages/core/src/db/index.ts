import pg from "pg";
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const q = <T extends pg.QueryResultRow = any>(text: string, params: unknown[] = []) => pool.query<T>(text, params).then(r => r.rows);
