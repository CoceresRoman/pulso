import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "@prometheus-io/client";

export function crearMetricasApi() {
  const registro = new Registry();
  collectDefaultMetrics({ register: registro });
  const pedidos = new Counter({
    name: "pulso_http_pedidos_total",
    help: "Pedidos HTTP atendidos por la api",
    labelNames: ["metodo", "ruta", "codigo"] as const,
    registers: [registro],
  });
  const duracion = new Histogram({
    name: "pulso_http_duracion_segundos",
    help: "Duración de los pedidos HTTP de la api",
    labelNames: ["metodo", "ruta"] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registro],
  });
  return { registro, pedidos, duracion };
}

export type MetricasApi = ReturnType<typeof crearMetricasApi>;

export function crearMetricasWorker(pendientes: () => Promise<number>) {
  const registro = new Registry();
  collectDefaultMetrics({ register: registro });
  const chequeos = new Counter({
    name: "pulso_chequeos_total",
    help: "Chequeos hechos por el worker, por resultado",
    labelNames: ["resultado"] as const,
    registers: [registro],
  });
  const duracion = new Histogram({
    name: "pulso_chequeo_duracion_segundos",
    help: "Duración de cada chequeo",
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
    registers: [registro],
  });
  new Gauge({
    name: "pulso_cola_pendientes",
    help: "Chequeos listos esperando un worker",
    registers: [registro],
    async collect() {
      try {
        this.set(await pendientes());
      } catch {
        // NaN en vez de romper /metrics: Prometheus sigue recibiendo el resto y el hueco se ve.
        this.set(Number.NaN);
      }
    },
  });
  return { registro, chequeos, duracion };
}

export type MetricasWorker = ReturnType<typeof crearMetricasWorker>;
