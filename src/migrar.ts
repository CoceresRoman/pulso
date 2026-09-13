import { fileURLToPath } from "node:url";
import { leerConfig } from "./compartido/config.ts";
import { crearPool } from "./compartido/db.ts";
import { crearLogger } from "./compartido/logger.ts";
import { migrar } from "./compartido/migrar.ts";

// Desde src/ y desde dist/ la carpeta queda un nivel arriba.
const CARPETA = fileURLToPath(new URL("../migraciones", import.meta.url));
const logger = crearLogger("migrar");

try {
  const config = leerConfig(process.env, ["DATABASE_URL"]);
  const pool = crearPool(config.databaseUrl);
  try {
    const aplicadas = await migrar(pool, CARPETA);
    logger.info({ aplicadas }, aplicadas.length > 0 ? "migraciones aplicadas" : "la base ya estaba al día");
  } finally {
    await pool.end();
  }
} catch (error) {
  logger.fatal({ err: error }, "no se pudieron aplicar las migraciones");
  process.exitCode = 1;
}
