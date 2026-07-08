import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  CORS_ORIGIN: z.string().default('http://localhost:8082,http://localhost:19006'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid MySQL connection URL'),
  JSON_BODY_LIMIT: z.string().default('100kb'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
});

const env = envSchema.parse(process.env);

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  corsOrigins: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
  databaseUrl: env.DATABASE_URL,
  jsonBodyLimit: env.JSON_BODY_LIMIT,
  rateLimitMax: env.RATE_LIMIT_MAX,
  rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
};
