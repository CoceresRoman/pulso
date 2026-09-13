import pg from "pg";

export function crearPool(url: string): pg.Pool {
  return new pg.Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
}
