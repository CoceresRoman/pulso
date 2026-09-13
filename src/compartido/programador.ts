import { Queue } from "bullmq";
import { Redis } from "ioredis";

export const NOMBRE_COLA = "chequeos";
export const NOMBRE_TRABAJO = "chequear";

export interface DatosTrabajo {
  monitorId: number;
}

export interface Programador {
  programar(monitor: { id: number; intervaloSegundos: number }): Promise<void>;
  quitar(monitorId: number): Promise<void>;
  pendientes(): Promise<number>;
  listo(): Promise<boolean>;
  cerrar(): Promise<void>;
}

export const idScheduler = (monitorId: number) => `monitor-${monitorId}`;

// Los workers de BullMQ exigen maxRetriesPerRequest: null en su conexión.
export function crearConexionWorker(redisUrl: string): Redis {
  return new Redis(redisUrl, { maxRetriesPerRequest: null });
}

export function crearProgramadorBullmq(redisUrl: string): Programador {
  const conexionCola = new Redis(redisUrl);
  // BullMQ no cierra las conexiones de ioredis que le pasamos armadas: si no la desconectamos
  // nosotros en cerrar(), sigue reintentando para siempre (y, sin este listener, cada intento
  // fallido tira un error no manejado).
  conexionCola.on("error", () => {});
  const cola = new Queue<DatosTrabajo>(NOMBRE_COLA, { connection: conexionCola });
  // Conexión aparte para el chequeo de salud: sin cola offline, falla enseguida si no hay conexión.
  const salud = new Redis(redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
  salud.on("error", () => {
    // Los errores de conexión se ven en listo(): sin este listener ioredis los tira como no manejados.
  });

  return {
    async programar(monitor) {
      // upsert: varias réplicas de la api pueden programar el mismo monitor sin duplicarlo.
      await cola.upsertJobScheduler(
        idScheduler(monitor.id),
        { every: monitor.intervaloSegundos * 1000 },
        { name: NOMBRE_TRABAJO, data: { monitorId: monitor.id } }
      );
    },
    async quitar(monitorId) {
      await cola.removeJobScheduler(idScheduler(monitorId));
    },
    async pendientes() {
      const cuentas = await cola.getJobCounts("waiting");
      return cuentas.waiting ?? 0;
    },
    async listo() {
      const timeout = new Promise<boolean>(resolve => setTimeout(() => resolve(false), 1000).unref());
      const ping = salud.ping().then(
        respuesta => respuesta === "PONG",
        () => false
      );
      return Promise.race([ping, timeout]);
    },
    async cerrar() {
      await cola.close();
      conexionCola.disconnect();
      salud.disconnect();
    },
  };
}
