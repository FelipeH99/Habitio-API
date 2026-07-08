# Habitio API

Backend MVP para Habitio.

## Stack

- Node.js + Express
- MySQL con SQL explicito usando `mysql2`
- TypeScript

Nota: el modelo recomendado originalmente para Prisma esta implementado como migracion SQL directa porque este backend no usa Prisma.

## Setup local completo

La API necesita MySQL. La forma mas simple para desarrollo local es Docker.

### 1. Levantar MySQL

```sh
docker run --name habitio-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=habitio \
  -e MYSQL_USER=habitio \
  -e MYSQL_PASSWORD=habitio \
  -p 3307:3306 \
  -d mysql:8
```

Se usa el puerto local `3307` para evitar conflicto si ya tenes otro MySQL en `3306`.

Si el contenedor ya existe y solo esta apagado:

```sh
docker start habitio-mysql
```

### 2. Configurar variables

```sh
cd /Users/felipeh/repos/Habitio/Habitio-API
cp .env.example .env
```

El `.env` local debe quedar asi:

```sh
DATABASE_URL="mysql://habitio:habitio@localhost:3307/habitio"
PORT=3002
NODE_ENV=development
CORS_ORIGIN="http://localhost:8082,http://localhost:19006"
JSON_BODY_LIMIT="100kb"
RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW_MS=60000
```

### 3. Instalar, migrar y levantar API

```sh
npm install
npm run db:migrate
npm run dev
```

La API local queda en:

```sh
http://localhost:3002
```

### 4. Verificar API y DB

En otra terminal:

```sh
curl http://localhost:3002/health
curl http://localhost:3002/health/db
curl http://localhost:3002/habits
```

Respuestas esperadas:

```json
{"status":"ok"}
```

`/habits` debe responder un JSON con `data`.

## Usar con la app local

En `../habitio-app/.env`:

```sh
EXPO_PUBLIC_API_URL=http://localhost:3002
EXPO_PUBLIC_HABITIO_USER_ID=dev-user
```

Luego levantar Expo desde el repo de la app:

```sh
cd /Users/felipeh/repos/Habitio/habitio-app
npx expo start --clear
```

La app convierte automaticamente `localhost` para simuladores nativos:

- Android emulator: usa `10.0.2.2`.
- iOS simulator y web: usa el host local.

Si cambias el puerto de la API, cambia tambien `EXPO_PUBLIC_API_URL` y reinicia Expo con `--clear`.

## Deploy

Camino recomendado para probar sin correr backend local: Railway con un servicio Node/Docker y un plugin MySQL.

Variables requeridas:

```sh
DATABASE_URL=mysql://USER:PASSWORD@HOST:PORT/DATABASE
NODE_ENV=production
CORS_ORIGIN=https://tu-app-web.example.com,http://localhost:8082,http://localhost:19006
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

## Habitos con horario y sin horario

`POST /habits` acepta dos variantes:

Habito sin horario:

```json
{
  "name": "Caminar 5 mil pasos",
  "description": "Meta flexible para completar durante el dia",
  "color": "blue",
  "privacy": "private"
}
```

Habito con horario:

```json
{
  "name": "Meditar",
  "description": "Sesion corta antes de trabajar",
  "color": "mint",
  "privacy": "private",
  "schedule": {
    "daysOfWeek": [1, 2, 3, 4, 5],
    "startTime": "09:00",
    "endTime": "09:30",
    "mode": "fixed"
  }
}
```

`GET /instances/today` devuelve instancias para ambos tipos. Las instancias sin horario usan `dueLabel: "En cualquier momento"`.

## Produccion

La API incluye:

- Validacion de variables de entorno al arrancar.
- Headers HTTP de seguridad con `helmet`.
- Rate limit basico configurable.
- `x-request-id` en cada respuesta.
- Logs de requests con metodo, ruta, status, duracion y request id.
- Errores JSON consistentes.

Variables opcionales:

```sh
JSON_BODY_LIMIT="100kb"
RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW_MS=60000
```
