export interface Config {
  puerto: number;
  puertoMetricas: number;
  databaseUrl: string;
  redisUrl: string;
  nivelLog: string;
  concurrencia: number;
  fallaSinTimeout: boolean;
  fallaFugaMemoria: boolean;
  fallaLatenciaMs: number;
}

export type VariableRequerida = "DATABASE_URL" | "REDIS_URL";

const NIVELES = ["fatal", "error", "warn", "info", "debug", "trace", "silent"];

// Toda la configuración sale de variables de entorno (12-factor). Si algo falta o está
// mal, se juntan todos los problemas en un solo error: el proceso no arranca a medias.
export function leerConfig(
  env: Record<string, string | undefined>,
  requeridas: readonly VariableRequerida[],
  puertoPorDefecto = 3000
): Config {
  const problemas: string[] = [];
  for (const nombre of requeridas) {
    if (!env[nombre]) problemas.push(`falta la variable ${nombre}`);
  }

  const entero = (nombre: string, porDefecto: number, min: number, max: number): number => {
    const crudo = env[nombre];
    if (crudo === undefined || crudo === "") return porDefecto;
    const valor = Number(crudo);
    if (!Number.isInteger(valor) || valor < min || valor > max) {
      problemas.push(`${nombre} debe ser un entero entre ${min} y ${max} (llegó "${crudo}")`);
      return porDefecto;
    }
    return valor;
  };

  const config: Config = {
    puerto: entero("PORT", puertoPorDefecto, 1, 65535),
    puertoMetricas: entero("METRICAS_PORT", 9464, 1, 65535),
    databaseUrl: env.DATABASE_URL ?? "",
    redisUrl: env.REDIS_URL ?? "",
    nivelLog: env.LOG_LEVEL || "info",
    concurrencia: entero("WORKER_CONCURRENCIA", 5, 1, 100),
    fallaSinTimeout: env.FALLA_SIN_TIMEOUT === "1",
    fallaFugaMemoria: env.FALLA_FUGA_MEMORIA === "1",
    fallaLatenciaMs: entero("FALLA_LATENCIA_MS", 0, 0, 60000),
  };

  if (!NIVELES.includes(config.nivelLog)) {
    problemas.push(`LOG_LEVEL debe ser uno de ${NIVELES.join(", ")} (llegó "${config.nivelLog}")`);
  }
  if (problemas.length > 0) throw new Error(`configuración inválida: ${problemas.join("; ")}`);
  return config;
}
