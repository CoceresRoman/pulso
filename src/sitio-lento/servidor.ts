import { configOSalir } from "../compartido/arranque.ts";
import { crearLogger } from "../compartido/logger.ts";
import { crearSitioLento } from "./app.ts";

const logger = crearLogger("sitio-lento");
const config = configOSalir(logger, [], 3001);
const servidor = crearSitioLento();

servidor.listen(config.puerto, () => logger.info({ puerto: config.puerto }, "sitio lento escuchando"));

for (const senal of ["SIGTERM", "SIGINT"] as const) {
  process.once(senal, () => {
    logger.info({ senal }, "apagando");
    // /colgado nunca termina solo: sin esto, close() esperaría para siempre.
    servidor.closeAllConnections();
    servidor.close(() => process.exit(0));
  });
}
