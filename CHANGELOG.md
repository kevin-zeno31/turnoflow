# Changelog

Los cambios relevantes del proyecto se registran aquí.

## [0.2.0] - 2026-10-09

### Añadido
- Interfaz dark SaaS responsive para las tres vistas.
- Métrica real de tiempo medio de espera de turnos llamados (últimos 30 días).
- Gráfico de atenciones completadas durante siete días (UTC).
- Contador de atenciones del día (UTC).
- Impresión de comprobante de turno y recuperación de sesión dentro de la misma pestaña.
- Tests de las nuevas métricas y flujo de CI con GitHub Actions.
- Documentación de arquitectura y seguridad para el portafolio.

### Conservado
- API REST original y flujo FIFO.
- Base de datos SQLite y protección contra duplicados.
- Restricción del servidor a conexiones locales.

## [0.1.0] - 2026-09-21

- Primera versión funcional con tres vistas y una cola SQLite persistente.
