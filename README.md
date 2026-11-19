# Habitio API

API para seguimiento de hábitos: crea hábitos con o sin horario, genera las instancias del día y registra check-ins y rachas.

**TypeScript · Node.js · Express 5 · MySQL · Zod · Docker**

## Qué demuestra

- Modelado relacional de usuarios, hábitos, ventanas horarias, instancias y rachas.
- SQL explícito con `mysql2`, transacciones y migraciones versionadas.
- Validación de entradas, errores JSON y seguimiento por `request-id`.
- Health checks y un script para probar el recorrido completo del MVP.

## Inicio local

Requisitos: Node.js 22, npm y MySQL 8. Docker permite levantar una base local:

```sh
git clone https://github.com/FelipeH99/Habitio-API.git
cd Habitio-API
npm ci
cp .env.example .env

docker run --name habitio-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=habitio \
  -e MYSQL_USER=habitio \
  -e MYSQL_PASSWORD=habitio \
  -p 127.0.0.1:3307:3306 -d mysql:8
```

Esperá a que MySQL esté listo y ejecutá:

```sh
npm run db:migrate
npm run dev
```

La configuración de ejemplo conecta a `localhost:3307` y sirve la API en `http://localhost:3002`. Si el contenedor ya existe, usá `docker start habitio-mysql`.

## Probar un hábito

```sh
curl http://localhost:3002/health
curl http://localhost:3002/health/db
curl -X POST http://localhost:3002/habits \
  -H 'Content-Type: application/json' \
  -d '{"name":"Leer 20 minutos","color":"mint","privacy":"private"}'
curl http://localhost:3002/instances/today
```

La última respuesta contiene IDs de instancias. Usá uno en `POST /instances/:id/checkin` para registrar que completaste el hábito.

## API y estructura

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/health` | Estado del proceso |
| GET | `/health/db` | Conectividad de MySQL |
| GET / POST | `/habits` | Listar y crear hábitos |
| GET | `/instances/today` | Generar/consultar instancias del día |
| POST | `/instances/:id/checkin` | Completar una instancia |

`src/app.ts` define rutas; `src/habits.ts`, la lógica y el SQL; `src/users.ts`, el usuario de demostración; `migrations/`, el esquema.

## Validación

```sh
npm run typecheck
npm run build
API_URL=http://localhost:3002 npm run smoke:remote
```

El smoke test requiere la API y MySQL encendidos y crea datos de prueba. No equivale a una suite unitaria aislada.

## Configuración

Las variables y valores locales están en [`.env.example`](.env.example): `DATABASE_URL`, `PORT`, `NODE_ENV`, `CORS_ORIGIN`, límites de JSON y rate limiting. Usá credenciales propias fuera del entorno local.

Para una app cliente, configurá su URL de API con `http://localhost:3002`. En un emulador Android suele ser necesario usar `10.0.2.2`; en un dispositivo físico, la IP accesible del equipo servidor.

## Alcance del MVP

La versión pública **no implementa autenticación**: usa `x-user-id` o `dev-user`. Ese header no demuestra identidad y no ofrece aislamiento seguro entre usuarios. Los headers HTTP, CORS y rate limiting no sustituyen autenticación ni autorización.

`npm run deploy:start` aplica migraciones y arranca el servidor compilado. Antes de exponerlo a usuarios reales, incorporá autenticación, autorización y pruebas de permisos.
