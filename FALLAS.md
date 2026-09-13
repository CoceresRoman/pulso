# Fallas

Pulso puede activar fallas a propósito, apagadas por defecto, para los labs de la ruta DevOps. Cada una es una variable de entorno: se prenden en el proceso que corresponde, no globalmente.

## `FALLA_LATENCIA_MS` (api)

**Qué hace:** suma esa demora, en milisegundos, a cada pedido bajo `/api` (no a `/healthz`, `/readyz` ni `/metrics`).

**Cómo activarla:** `FALLA_LATENCIA_MS=500` al arrancar la api.

**Qué se ve:** el histograma `pulso_http_duracion_segundos` en `/metrics` se corre hacia buckets más altos; en la web, cargar la tabla y dar de alta un monitor se sienten lentos. `/healthz` sigue respondiendo al instante, así que un orquestador que solo mira `/healthz` no se entera.

**Para qué sirve:** practicar autoscaling por latencia (HPA), alertas de latencia y definir un SLO.

## `FALLA_FUGA_MEMORIA` (api)

**Qué hace:** retiene 1 MB por cada pedido bajo `/api`, sin liberarlo nunca.

**Cómo activarla:** `FALLA_FUGA_MEMORIA=1` al arrancar la api.

**Qué se ve:** `process_resident_memory_bytes` en `/metrics` crece en línea recta, un mega por pedido, hasta que el proceso llega al límite de memoria del contenedor y el orquestador lo mata (`OOMKilled`). `/healthz` y `/readyz` responden normal hasta el final: el síntoma está en la métrica de memoria, no en la salud.

**Para qué sirve:** practicar límites de memoria (`resources.limits.memory`), ver un `OOMKilled` real y el reinicio que sigue.

## `FALLA_SIN_TIMEOUT` (worker)

**Qué hace:** el chequeo ignora el `timeoutMs` del monitor: si el sitio no responde, el `fetch` se queda esperando para siempre en vez de cortar.

**Cómo activarla:** `FALLA_SIN_TIMEOUT=1` al arrancar el worker, con un monitor apuntando a `http://sitio-lento:3001/colgado`.

**Qué se ve:** ese chequeo nunca termina, ocupa uno de los `WORKER_CONCURRENCIA` slots del worker para siempre; `pulso_cola_pendientes` crece porque los chequeos siguientes se acumulan esperando un slot libre; los demás monitores dejan de actualizarse en la web (su `ultimoChequeo` se queda viejo); y al mandar SIGTERM el worker espera los 25 s completos sin terminar de cerrar, porque el chequeo colgado nunca resuelve.

**Para qué sirve:** es el incidente del curso de observabilidad — diagnosticar, con logs y métricas, por qué el sistema dejó de progresar sin haberse caído.
