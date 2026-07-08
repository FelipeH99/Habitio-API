import 'dotenv/config';

const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:8082,http://localhost:19006';
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required. Copy .env.example to .env and point it to a real MySQL database.'
  );
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  corsOrigins: corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean),
  databaseUrl,
};
