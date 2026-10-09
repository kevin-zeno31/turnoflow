# TurnoFlow

**Sistema de gestión de turnos para espacios de atención.** Un proyecto Full Stack de portafolio construido con **JavaScript, Node.js y SQLite**, sin frameworks ni dependencias de producción.

TurnoFlow permite que una persona solicite un número, que un operador llame al siguiente turno en orden de llegada y que una pantalla pública muestre la atención actual. Incluye información persistente y un panel renovado con métricas reales.

> **Estado:** v0.2 · Demo local. No usar para operaciones reales con público hasta incorporar autenticación, permisos y una revisión de seguridad.

## Tres experiencias en una aplicación

| Vista | Función | Ruta |
| --- | --- | --- |
| **Operador** | Control de fila, atención actual, estadísticas e historial. | `/#operador` |
| **Solicitar** | Emisión de un número e impresión de comprobante. | `/#solicitar` |
| **Pantalla pública** | Visualización del turno activo y los próximos números. | `/#pantalla` |

### Características implementadas

- Turnos correlativos `A-001`, `A-002`... por orden de llegada (**FIFO**).
- Una única atención activa por módulo, validada por transacciones en SQLite.
- Persistencia de turnos entre reinicios del servidor.
- Protección de reintentos de emisión mediante claves de idempotencia.
- Panel con turnos pendientes, activos, finalizados y espera promedio (últimos 30 días).
- Gráfico de atenciones finalizadas de los últimos siete días, agrupado por fecha **UTC**.
- Historial de últimas atenciones y número de atenciones finalizadas hoy (UTC).
- Comprobante imprimible y recuperación del último comprobante dentro de la pestaña.
- Actualización de la información cada tres segundos cuando la pestaña está visible.
- Mensajes de error, controles deshabilitados durante operaciones y aviso de conexión.
- Diseño oscuro adaptable a escritorio y celular, sin fuentes ni scripts externos.
- Pruebas automatizadas de API, base de datos, persistencia y métricas.

## Ejecutar en Windows

**Requisito:** Node.js **24 o superior** ([nodejs.org](https://nodejs.org/)).

```powershell
git clone https://github.com/kevin-zeno31/turnoflow.git
cd turnoflow
node --version
npm start
```

Abre **http://localhost:3000**. Para detener el servidor: `Ctrl+C`.

No necesitas `npm install`, Docker, servidor externo de base de datos ni una tarjeta de crédito. Si PowerShell bloquea `npm.ps1`, puedes ejecutar `npm.cmd start` o `node server.js`.

### Recorrido recomendado

1. Abre `http://localhost:3000/#solicitar` y presiona **Obtener mi turno**.
2. Abre una segunda pestaña con `http://localhost:3000/#operador` y llama al siguiente turno.
3. Abre `http://localhost:3000/#pantalla` para ver el número y el módulo.
4. Vuelve al operador, finaliza la atención y revisa las métricas.
5. Reinicia `npm start` para comprobar que la información se conserva.

> Las tres vistas son accesibles en el mismo computador. La vista del operador **no está protegida por autenticación**: no debes exponer el servidor en internet.

## Arquitectura

```text
┌───────────────────────────────────────┐
│ Navegador · HTML + CSS + JavaScript   │
│ Operador · Solicitar · Pantalla       │
└────────────────────┬──────────────────┘
                     │ HTTP + JSON
┌────────────────────▼──────────────────┐
│ Node.js · server.js                    │
│ API REST, validaciones y servidor web │
└────────────────────┬──────────────────┘
                     │
┌────────────────────▼──────────────────┐
│ SQLite · store.js                      │
│ Fila FIFO, transacciones, métricas     │
└───────────────────────────────────────┘
```

| Archivo | Responsabilidad |
| --- | --- |
| `public/index.html` | Vistas y elementos accesibles de la interfaz. |
| `public/style.css` | Identidad visual responsive e impresión. |
| `public/app.js` | Renderizado, eventos, polling y comunicación con la API. |
| `server.js` | API HTTP, validación, cabeceras y archivos públicos. |
| `store.js` | Persistencia SQLite y operaciones transaccionales. |
| `test/queue.test.js` | Pruebas de reglas, API, concurrencia y métricas. |
| `docs/architecture.md` | Decisiones, contratos y limitaciones técnicas. |

### Endpoints principales

| Método | Ruta | Acción |
| --- | --- | --- |
| `GET` | `/api/queue` | Estado y estadísticas de la fila. |
| `POST` | `/api/tickets` | Crear o recuperar un turno con `{ "requestKey": "..." }`. |
| `POST` | `/api/call` | Llamar al primer turno pendiente con `{}`. |
| `POST` | `/api/finish` | Finalizar el turno activo con `{ "id": 1 }`. |

Operaciones incompatibles con la fila devuelven `409`; entradas inválidas, `400`. El servidor rechaza solicitudes web cross-site y escucha únicamente en `127.0.0.1`.

## Pruebas

```powershell
npm test
```

La suite cubre persistencia, FIFO, reintentos, llamadas simultáneas, errores de API, aislamiento local y esquema de las métricas. Las pruebas usan bases de datos temporales, sin modificar tus turnos.

## Seguridad y límites

- Solo para demostración **en un equipo local**. No hay usuarios, autenticación ni roles.
- Las solicitudes de operador no están autorizadas por cuenta. Antes de un despliegue real se deben añadir autenticación, permisos, auditoría y controles de abuso.
- No se recopilan nombres, RUT, correos ni números de teléfono.
- Los datos se guardan en `data/turnoflow.sqlite`; `data/` está ignorada por Git.
- Los turnos no se reinician por día. Los contadores históricos son acumulados.
- Los siete días del gráfico y el indicador **hoy** utilizan UTC. La hora mostrada en filas utiliza la zona horaria del navegador.
- Solo hay un módulo de atención y no existe la opción de cancelar un turno.
- La actualización usa polling cada 3 segundos (todavía no WebSockets).

## Próximos hitos

- [ ] Autenticación de operador y separación de permisos.
- [ ] Múltiples módulos y tipos de atención.
- [ ] Cancelación, pausas y transferencia de turnos.
- [ ] Alertas de llamado y configuración de accesibilidad.
- [ ] Reportes exportables y métricas por módulo.
- [ ] Demo desplegada con mecanismos de seguridad y datos ficticios.

## Autor

Proyecto desarrollado para el portafolio de **[kevin-zeno31](https://github.com/kevin-zeno31)**.

**Stack:** JavaScript · HTML5 · CSS3 · Node.js · SQLite · GitHub Actions.
