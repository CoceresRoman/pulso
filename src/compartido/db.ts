import pg from "pg";

export function crearPool(url: string): pg.Pool {
  return new pg.Pool({
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    // Si la conexión ya está abierta y Postgres deja de responder (pausado, cortado por
    // firewall), connectionTimeoutMillis no ayuda: sin esto, una consulta se puede colgar
    // sin límite.
    query_timeout: 5_000,
  });
}

// Para /readyz: si la conexión ya está abierta pero Postgres no responde, query_timeout
// (5 s, ver crearPool) igual sería una espera larga para una probe. Acotamos acá aparte,
// igual que el chequeo de la cola en programador.ts, y limpiamos el timer apenas gana
// cualquiera de las dos.
export function dbListo(db: pg.Pool, timeoutMs = 1000): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    const limite = setTimeout(() => resolve(false), timeoutMs);
    limite.unref();
    db.query("select 1").then(
      () => {
        clearTimeout(limite);
        resolve(true);
      },
      () => {
        clearTimeout(limite);
        resolve(false);
      }
    );
  });
}
