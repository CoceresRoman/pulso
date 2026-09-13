import { test } from "node:test";
import assert from "node:assert/strict";
import type pg from "pg";
import { dbListo } from "../../src/compartido/db.ts";

test("dbListo da false rápido si la consulta se cuelga", async () => {
  const colgada = { query: () => new Promise(() => {}) } as unknown as pg.Pool;
  const inicio = performance.now();
  assert.equal(await dbListo(colgada, 100), false);
  assert.ok(performance.now() - inicio < 500, "dbListo tardó demasiado");
});

test("dbListo da true si la consulta resuelve", async () => {
  const sana = { query: async () => ({ rows: [] }) } as unknown as pg.Pool;
  assert.equal(await dbListo(sana), true);
});

test("dbListo da false si la consulta rechaza", async () => {
  const rota = {
    query: async () => {
      throw new Error("boom");
    },
  } as unknown as pg.Pool;
  assert.equal(await dbListo(rota), false);
});
