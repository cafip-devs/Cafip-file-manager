# FileManager

Microservicio NestJS para **subida de archivos** (firmas) y **generación de informes**.

- Documentación de la API con **Scalar** en `/docs`.
- Misma estructura de proyecto que el módulo de presupuesto.

## Módulos

- **Firmas**: subida de PDFs de firmas a Cloudflare R2 (antes en el módulo `archivos` del proyecto presupuesto).

## Requisitos

- Node.js 20+
- Cuenta Cloudflare R2 (o S3 compatible) para almacenamiento.

## Instalación

```bash
cd file-manager
npm install
```

## Variables de entorno

Copia `.env.example` a `.env` y configura:

- `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` (o `R2_PUBLIC_DOMAIN`).
- Opcional: `PORT` (por defecto 3001), `API_BASE_URL`.

## Ejecución

```bash
# Desarrollo
npm run start:dev

# Producción
npm run build
npm run start:prod
```

Por defecto el servidor corre en **http://localhost:3001** y la documentación en **http://localhost:3001/docs**.

## Endpoints

| Método | Ruta     | Descripción              |
|--------|----------|--------------------------|
| POST   | /firmas  | Subir firma (PDF)        |

Los demás endpoints (p. ej. generación de informes) se irán añadiendo en este mismo servicio.
