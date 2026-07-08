import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function asyncRoute(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>
) {
  return (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response, next).catch(next);
  };
}

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    return response.status(error.status).json({ error: error.message, details: error.details });
  }

  if (error instanceof ZodError) {
    return response.status(400).json({ error: 'Invalid request body', details: error.flatten() });
  }

  console.error(error);
  return response.status(500).json({ error: 'Internal server error' });
}
