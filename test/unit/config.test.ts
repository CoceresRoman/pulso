import { test } from "node:test";
import assert from "node:assert/strict";
import { leerConfig } from "../../src/compartido/config.ts";

const BASICO = { DATABASE_URL: "postgres://u:p@h/db", REDIS_URL: "redis://h:6379" };

test("con lo mínimo usa los valores por defecto", () => {
  assert.deepEqual(leerConfig(BASICO, ["DATABASE_URL", "REDIS_URL"]), {
    puerto: 3000,
    puertoMetricas: 9464,
    databaseUrl: "postgres://u:p@h/db",
    redisUrl: "redis://h:6379",
    nivelLog: "info",
    concurrencia: 5,
    fallaSinTimeout: false,
    fallaFugaMemoria: false,
    fallaLatenciaMs: 0,
  });
});

test("junta todos los problemas en un solo error", () => {
  assert.throws(
    () => leerConfig({ PORT: "abc" }, ["DATABASE_URL", "REDIS_URL"]),
    (error: Error) => {
      assert.match(error.message, /^configuración inválida: /);
      assert.match(error.message, /falta la variable DATABASE_URL/);
      assert.match(error.message, /falta la variable REDIS_URL/);
      assert.match(error.message, /PORT debe ser un entero entre 1 y 65535 \(llegó "abc"\)/);
      return true;
    }
  );
});

test("lee las fallas activables", () => {
  const config = leerConfig(
    { ...BASICO, FALLA_SIN_TIMEOUT: "1", FALLA_FUGA_MEMORIA: "0", FALLA_LATENCIA_MS: "250" },
    ["DATABASE_URL", "REDIS_URL"]
  );
  assert.equal(config.fallaSinTimeout, true);
  assert.equal(config.fallaFugaMemoria, false);
  assert.equal(config.fallaLatenciaMs, 250);
});

test("un nivel de log desconocido es un error", () => {
  assert.throws(() => leerConfig({ ...BASICO, LOG_LEVEL: "verbose" }, []), /LOG_LEVEL debe ser uno de/);
});

test("sin variables requeridas, el sitio lento arranca con su puerto por defecto", () => {
  assert.equal(leerConfig({}, [], 3001).puerto, 3001);
});
