import 'dotenv/config';

const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:8082,http://localhost:19006';

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  corsOrigins: corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean),
  databaseUrl: process.env.DATABASE_URL ?? 'mysql://habitio:habitio@localhost:3306/habitio',
};
