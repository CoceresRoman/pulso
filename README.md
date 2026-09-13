# Pulso

Monitor de uptime hecho para practicar DevOps en la [ruta DevOps](https://curso.romancoceres.com/rutas/devops) del curso.

## Qué hace

Pulso guarda URLs a monitorear, las chequea a intervalos y expone su estado por HTTP. Son cuatro procesos que corren la misma imagen con distinto comando, más una status page estática:

| Proceso | Comando | Qué hace |
|---|---|---|
| api | `npm run api` | HTTP para dar de alta/baja monitores, consultar su estado y las métricas propias |
| worker | `npm run worker` | toma los chequeos de la cola, pega el `GET` a cada URL y guarda el resultado |
| sitio-lento | `npm run sitio-lento` | sitio de prueba: responde bien, lento, con error o nunca (para los labs) |
| migrar | `npm run migrar` | aplica las migraciones de `migraciones/` una sola vez, con lock |
| `web/` | archivos estáticos | status page: lista los monitores y permite agregar o quitar |

```text
navegador → reverse proxy → web/ (estáticos)
                          → /api → api → Postgres
                                       → cola (Valkey/Redis)

worker → cola (Valkey/Redis)
       → Postgres
       → los sitios monitoreados
```

## Requisitos

- Node 24 (fijado en `.nvmrc`).
- Postgres 18.
- Valkey 9 (o Redis 6.2+, que es con lo que habla BullMQ).

Este repo no trae `Dockerfile`, `compose.yaml` ni manifests a propósito: esa infraestructura se escribe en los cursos, no acá.

## Usar esta plantilla

Este repo es una plantilla de GitHub. Para tener tu propia copia con historia propia (no un fork): botón **Use this template** en GitHub → **Create a new repository**, elegí que sea público (los cursos leen el código ahí) y cloná tu copia.

## Correr sin Docker

```bash
npm ci
npm run build

export DATABASE_URL=postgres://usuario:clave@localhost:5432/pulso
export REDIS_URL=redis://localhost:6379

npm run migrar
```

Después, en tres terminales:

```bash
npm run api
npm run worker
npm run sitio-lento
```

Para probar:

```bash
curl -s localhost:3000/api/estado

curl -s -X POST localhost:3000/api/monitores \
  -H 'content-type: application/json' \
  -d '{"url":"http://localhost:3001/ok","intervaloSegundos":10}'
```

La web (`web/`) no tiene servidor propio: son archivos estáticos que necesitan un reverse proxy que los sirva y pase `/api` a la api (nginx, se arma en el curso 1). Sin eso, abrir `web/index.html` directo del disco no va a poder pedirle nada a la api.

## Variables de entorno

| Variable | Proceso | Por defecto |
|---|---|---|
| `PORT` | api (3000), sitio-lento (3001) | según el proceso |
| `METRICAS_PORT` | worker | `9464` |
| `DATABASE_URL` | api, worker, migrar | — (obligatoria) |
| `REDIS_URL` | api, worker | — (obligatoria) |
| `LOG_LEVEL` | todos | `info` |
| `WORKER_CONCURRENCIA` | worker | `5` |
| `FALLA_LATENCIA_MS` | api | `0` — ver [FALLAS.md](./FALLAS.md) |
| `FALLA_FUGA_MEMORIA` | api | `0` — ver [FALLAS.md](./FALLAS.md) |
| `FALLA_SIN_TIMEOUT` | worker | `0` — ver [FALLAS.md](./FALLAS.md) |

## Endpoints

### api (`PORT`, 3000 por defecto)

| Método y ruta | Respuestas |
|---|---|
| `GET /healthz` | 200 `{"estado":"ok"}` mientras el proceso vive |
| `GET /readyz` | 200 `{"estado":"listo","base":true,"cola":true}`; 503 `{"estado":"no_listo","base":bool,"cola":bool}`; 503 `{"estado":"cerrando"}` después de SIGTERM |
| `GET /metrics` | 200 texto de Prometheus |
| `GET /api/estado` | 200 `EstadoMonitor[]` |
| `GET /api/monitores` | 200 `Monitor[]` |
| `POST /api/monitores` | 201 `Monitor`; 400 `{"error":"validacion","detalles":[...]}`; 503 `{"error":"cola_no_disponible"}` (no queda el alta) |
| `GET /api/monitores/:id` | 200 `Monitor`; 404 `{"error":"no_encontrado"}` (también con un id que no es número) |
| `PATCH /api/monitores/:id` | 200 `Monitor`; 400; 404; 503 (el monitor queda como estaba) |
| `DELETE /api/monitores/:id` | 204; 404; 503 (no se borra) |
| `GET /api/monitores/:id/chequeos?limite=N` | 200 `Chequeo[]` del más nuevo al más viejo, `limite` 1-500 (50 por defecto); 400; 404 |
| Cualquier otra | 404 `{"error":"no_encontrado"}` |
| JSON roto | 400 `{"error":"json_invalido"}`; cuerpo de más de 10 kB: 413 `{"error":"cuerpo_demasiado_grande"}` |
| Error inesperado | 500 `{"error":"interno"}` y log `error` |

Reglas de validación: `url` obligatoria, `http` o `https`, hasta 2048 caracteres; `intervaloSegundos` entero 10-3600 (30 por defecto); `timeoutMs` entero 100-30000 (5000 por defecto) y menor que el intervalo en milisegundos; campos desconocidos rechazados.

### sitio-lento (`PORT`, 3001 por defecto)

Sitio de prueba para los labs: no forma parte del contrato de Pulso, pero lo usan los monitores de ejemplo.

| Método y ruta | Respuestas |
|---|---|
| `GET /ok` | 200 |
| `GET /healthz` | 200 |
| `GET /lento?ms=N` | 200 después de N ms (0-60000); 400 si N es inválido |
| `GET /error?codigo=N` | responde con el código N si está entre 400 y 599, si no 500 |
| `GET /colgado` | nunca responde |
| Cualquier otra | 404 |

### worker — servidor de métricas (`METRICAS_PORT`, 9464 por defecto)

El worker no atiende HTTP de negocio: este servidor chico es solo para Prometheus y las probes.

| Método y ruta | Respuestas |
|---|---|
| `GET /healthz` | 200 `{"estado":"ok"}` |
| `GET /readyz` | 200 `{"estado":"listo","base":true,"cola":true}`; 503 `{"estado":"no_listo",...}`; 503 `{"estado":"cerrando"}` después de SIGTERM |
| `GET /metrics` | 200 texto de Prometheus |

## Salud y métricas

`/healthz` responde mientras el proceso está vivo, sin chequear dependencias. `/readyz` chequea que Postgres y la cola respondan (503 si no) y pasa a `{"estado":"cerrando"}` (503) apenas llega SIGTERM, antes de que termine de cerrar. `/metrics` expone texto de Prometheus, con las métricas de proceso por defecto más las propias:

**api**

- `pulso_http_pedidos_total{metodo,ruta,codigo}`: pedidos atendidos.
- `pulso_http_duracion_segundos{metodo,ruta}`: histograma de duración por ruta.

**worker**

- `pulso_chequeos_total{resultado="ok"|"falla"}`: chequeos hechos.
- `pulso_chequeo_duracion_segundos`: histograma de duración de cada chequeo.
- `pulso_cola_pendientes`: chequeos esperando un worker; `NaN` si la cola no responde (no rompe el resto de `/metrics`).

## Tests

- `npm test`: unitarios y de datos (estos últimos contra PGlite, en memoria). No necesitan Postgres ni Valkey corriendo.
- `npm run test:integracion`: contra servicios reales. Necesita `TEST_DATABASE_URL` y `TEST_REDIS_URL` — **nunca** `DATABASE_URL`: los tests borran el esquema `public` de esa base en cada archivo.

## Apagado

Con SIGTERM (lo manda Docker o Kubernetes al bajar un contenedor):

- **api**: `/readyz` pasa a `{"estado":"cerrando"}`, deja de aceptar conexiones nuevas, termina los pedidos en curso y cierra la conexión a la base y a la cola.
- **worker**: deja de tomar trabajos nuevos y espera hasta 25 s a que terminen los chequeos en curso antes de cerrar.

`npm run <script>` reporta el código de salida 143 al recibir SIGTERM aunque el proceso haya terminado con 0 (lo intercepta npm, no el script). En producción (systemd, contenedores) conviene arrancar los procesos con `node dist/...` directo, no con `npm run`, para ver el código de salida real.

## Licencia

MIT. Ver [LICENSE](./LICENSE).
