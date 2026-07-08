# Habitio API

Backend MVP para Habitio.

## Stack

- Node.js + Express
- MySQL con SQL explicito usando `mysql2`
- TypeScript

Nota: el modelo recomendado originalmente para Prisma esta implementado como migracion SQL directa porque este backend no usa Prisma.

## Setup local

```sh
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

La app Expo debe apuntar a esta API con:

```sh
EXPO_PUBLIC_API_URL=http://localhost:3000
```

## Deploy

Camino recomendado para probar sin correr backend local: Railway con un servicio Node/Docker y un plugin MySQL.

Variables requeridas:

```sh
DATABASE_URL=mysql://USER:PASSWORD@HOST:PORT/DATABASE
NODE_ENV=production
CORS_ORIGIN=https://tu-app-web.example.com,http://localhost:8082
```

Comandos de la plataforma:

```sh
npm run build
npm run deploy:start
```

`deploy:start` ejecuta las migraciones SQL pendientes y despues inicia la API. Si usas Docker, el `Dockerfile` ya ejecuta ese comando.

Para verificar el deploy desde cualquier navegador:

```sh
curl https://tu-api-publica.example.com/health
curl https://tu-api-publica.example.com/health/db
```

Para probar el flujo MVP completo contra la URL publica:

```sh
API_URL=https://tu-api-publica.example.com npm run smoke:remote
```

Ese comando valida health, conexion a DB, creacion de habito, listado de habitos, instancias de hoy y check-in.

Luego configura la app con la URL publica:

```sh
EXPO_PUBLIC_API_URL=https://tu-api-publica.example.com
EXPO_PUBLIC_HABITIO_USER_ID=dev-user
```

## Endpoints MVP

- `GET /health`
- `GET /health/db`
- `GET /habits`
- `POST /habits`
- `GET /instances/today`
- `POST /instances/:id/checkin`

Durante el MVP sin autenticacion, la API usa el header `x-user-id` si existe y, si no, crea/usa `dev-user`.
