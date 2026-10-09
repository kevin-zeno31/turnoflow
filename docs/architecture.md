# Arquitectura y decisiones de TurnoFlow

## Objetivo

Modelar un flujo de atención de una sola fila y un único operador en un equipo local, sin recolectar datos personales. Esta versión es un demostrador técnico y visual, no un sistema listo para producción.

## Módulos

- `public/index.html`: estructura semántica de la interfaz. Contiene tres secciones con navegación por hash.
- `public/style.css`: tokens visuales, responsive y una hoja de impresión para los comprobantes.
- `public/app.js`: se conecta con la API por `fetch`, actualiza estado cada tres segundos y construye contenido con `textContent` para evitar interpretar valores como HTML.
- `server.js`: servidor HTTP nativo de Node, cuerpo JSON limitado a 4 KB, cabeceras restrictivas, rutas explícitas y escucha en loopback.
- `store.js`: SQLite con operaciones de transacción `BEGIN IMMEDIATE` y una restricción única que impide más de un turno activo.

## Persistencia

La tabla `tickets` contiene `id`, `request_key`, `status`, `created_at`, `called_at`, `finished_at`. Los estados permitidos son `waiting`, `active` y `done`.

La numeración `A-001` se construye desde el ID. No se reinicia al cambiar el día. Las claves de idempotencia impiden que una retransmisión cree dos turnos.

## Analítica de v0.2

- `waitingCount` y `doneCount` cuentan turnos de la tabla.
- `completedToday` cuenta finalizaciones del día actual UTC.
- `averageWaitMinutes` toma el promedio de `called_at - created_at` para turnos llamados durante los últimos 30 días; es `null` cuando no hay muestra.
- `weekly` contiene siete fechas UTC y sus finalizaciones. Los días sin registros tienen 0.
- `recent` devuelve las últimas cinco finalizaciones.

Estas métricas son para demostración: no separan operadores ni tipos de trámite.

## Seguridad: límites deliberados

El backend escucha en `127.0.0.1` y valida `Host`/`Origin`; sirve únicamente cuatro recursos estáticos autorizados y no muestra archivos del servidor, bases de datos o `.env`. Esto reduce exposición accidental, pero **no equivale a autenticación**.

No desplegar esta versión para usuarios externos. Antes de hacerlo: autenticación de operador, autorización por roles, auditoría, rate limiting, política de despliegue, protección CSRF según mecanismo de sesiones y pruebas de seguridad.

## Flujo de desarrollo sugerido

Crear una rama `feature/...`, implementar mejoras, ejecutar `npm test`, revisar el diff y abrir Pull Request hacia `main`. El workflow de GitHub Actions ejecuta la suite con Node 24.
