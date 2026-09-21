# TurnoFlow

Primera versión de un gestor de turnos construido desde cero para un portafolio de desarrollo. Permite solicitar un número, llamar al siguiente y finalizar su atención. Es una **demostración local**, con una fila y un módulo de atención.

## Arranque rápido en Windows

1. Instala **Node.js 24 o posterior** desde https://nodejs.org si aún no lo tienes. Comprueba la versión con `node --version`.
2. Extrae todo el ZIP. Abre la carpeta `turnoflow` en VS Code o en una terminal.
3. Ejecuta `npm start`.
4. Abre **http://localhost:3000** en tu navegador.
5. Detén el servidor con **Ctrl+C** en la terminal cuando termines.

No se necesita `npm install`: esta versión no tiene dependencias externas. No utiliza Docker, emuladores, herramientas de compilación ni servicios de pago. No se instala como servicio de Windows ni se configura para arrancar automáticamente.

Si PowerShell bloquea `npm.ps1`, usa `npm.cmd start` o directamente `node server.js`; no necesitas cambiar la política de ejecución.

## Prueba el recorrido

Abre tres pestañas en el mismo navegador:

- http://localhost:3000/#solicitar — presiona **Obtener mi turno**.
- http://localhost:3000/#operador — presiona **Llamar siguiente turno**.
- http://localhost:3000/#pantalla — comprueba que aparece el número y módulo.

Vuelve al operador y presiona **Finalizar atención**. Solicita varios turnos para comprobar el orden de llegada. Las vistas visibles consultan al servidor cada tres segundos. Las pestañas ocultas pausan esas consultas y actualizan al volver.

## Qué incluye

- Interfaz adaptable a celular y escritorio, en español.
- API HTTP y persistencia real en SQLite.
- Numeración continua `A-001`, `A-002`, etc.; no se reinicia cada día.
- Un solo turno en atención, protegido por transacción y restricción de base de datos.
- Reintento de creación con clave de idempotencia: una misma solicitud no duplica turnos.
- Validaciones, mensajes de error, botones bloqueados durante operaciones y estado de conexión.
- Pruebas de persistencia, flujo FIFO, concurrencia y validación HTTP.

## Arquitectura

| Archivo | Responsabilidad |
| --- | --- |
| `public/index.html` | Estructura de las tres vistas |
| `public/style.css` | Presentación y adaptación a pantallas |
| `public/app.js` | Interacción del navegador y llamadas a la API |
| `server.js` | Servidor HTTP, rutas y validación de entrada |
| `store.js` | Reglas de la fila, transacciones y consultas SQLite |
| `test/queue.test.js` | Pruebas automatizadas |

Flujo: navegador → API de Node.js → base SQLite. Se usa JavaScript nativo en la interfaz para mantener pequeño el primer proyecto y hacer visible cada paso. Node incluye HTTP y SQLite; el sistema no depende de un servidor de base de datos aparte. Una futura versión puede migrar la interfaz a React manteniendo el contrato HTTP.

## API

| Método y ruta | Entrada JSON | Resultado |
| --- | --- | --- |
| `GET /api/queue` | — | Turno activo, fila y contadores |
| `POST /api/tickets` | `{"requestKey":"identificador-unico-123"}` | Turno creado o existente para esa clave |
| `POST /api/call` | `{}` | Primer turno pendiente |
| `POST /api/finish` | `{"id":1}` | Turno finalizado |

Las operaciones incompatibles con el estado de la fila devuelven `409`. Las entradas inválidas devuelven `400`. El listado muestra como máximo los primeros 100 turnos pendientes; el contador incluye todos.

## Pruebas

Ejecuta `npm test` (o `node --test`). Las pruebas utilizan bases temporales, sin tocar tus turnos locales.

## Datos y consumo

La base se crea en `data/turnoflow.sqlite`. Los turnos permanecen al cerrar y abrir. No se recopilan nombres, RUT, correos ni teléfonos. `data/` está excluido de Git. Para respaldarla, detén primero el servidor y copia la carpeta `data` completa.

Mientras está abierto hay un proceso Node.js y las pestañas del navegador. Su consumo no es cero y depende del uso; esta arquitectura evita procesos de compilación, contenedores y bases de datos separadas. No se ha medido el consumo en tu PC. Con Ctrl+C se detiene el servidor; cierra también las pestañas cuando quieras liberar sus recursos.

## Límites de esta versión

No incluye cuentas ni autenticación. El panel del operador es una vista de demostración, no un rol protegido. El servidor acepta conexiones únicamente desde el mismo PC y rechaza orígenes web ajenos. No permite conectar una pantalla de otro dispositivo. **No publiques este servidor en internet ni cambies su enlace de red para uso real** sin añadir autenticación, permisos, límites de solicitudes y revisar el despliegue.

La pantalla pública es una vista del mismo servidor local. Si se pierde la conexión, conserva el último dato visible con un aviso de desactualización. Las cifras de finalizados son acumuladas, no diarias. No hay cancelación de turnos, múltiples módulos, sonidos ni métricas avanzadas.

## Próximas etapas

1. Revisar juntos el recorrido y comprender `app.js`, `server.js` y `store.js`.
2. Crear un repositorio independiente `turnoflow` en tu GitHub y subir esta base; no mezclarla con el repositorio de perfil.
3. Añadir acceso del operador y permisos antes de publicar una demo compartida.
4. Seleccionar alojamiento sin coste comprobando sus límites vigentes, sin introducir tarjeta ni activar cobros.
5. Documentar la demo con capturas y decisiones técnicas.

Este paquete no crea ni modifica repositorios en GitHub y no contrata alojamiento. Node.js, SQLite y el código de esta base no requieren una suscripción de pago.
