import { randomUUID } from 'node:crypto';
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

export function requestContext(request: Request, response: Response, next: NextFunction) {
  const requestId = request.header('x-request-id') ?? randomUUID();
  response.locals.requestId = requestId;
  response.setHeader('x-request-id', requestId);
  next();
}

export function requestLogger(request: Request, response: Response, next: NextFunction) {
  const startedAt = Date.now();

  response.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const requestId = response.locals.requestId;
    console.info(`${request.method} ${request.originalUrl} ${response.statusCode} ${durationMs}ms requestId=${requestId}`);
  });

  next();
}

export function notFoundHandler(request: Request, response: Response) {
  response.status(404).json({
    error: 'Route not found',
    path: request.path,
    requestId: response.locals.requestId,
  });
}

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    return response.status(error.status).json({
      error: error.message,
      details: error.details,
      requestId: response.locals.requestId,
    });
  }

  if (error instanceof ZodError) {
    return response.status(400).json({
      error: 'Invalid request body',
      details: error.flatten(),
      requestId: response.locals.requestId,
    });
  }

  console.error(error);
  return response.status(500).json({
    error: 'Internal server error',
    requestId: response.locals.requestId,
  });
}
