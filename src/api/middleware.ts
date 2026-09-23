import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AuthService } from '../services/authService';
import { logger } from '../utils/logger';
import { User } from '../domain/types';

/**
 * Middleware layer for the REST API.
 *
 * These composable middlewares run in front of route handlers to provide:
 *   - request logging
 *   - authentication (JWT)
 *   - role-based authorization
 *   - request body validation (Zod)
 *   - centralized error handling
 */

export interface AuthedRequest extends Request {
  user?: { id: string; username: string; role: User['role'] };
}

export function requestLogger(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      logger.info('http', {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        durationMs: Date.now() - start,
      });
    });
    next();
  };
}

export function authenticate(authService: AuthService): RequestHandler {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }
    const token = header.slice('Bearer '.length);
    const payload = authService.verifyToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    req.user = { id: payload.sub, username: payload.username, role: payload.role };
    next();
  };
}

export function authorize(...roles: User['role'][]): RequestHandler {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden: insufficient role' });
      return;
    }
    next();
  };
}

export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function errorHandler(): (err: any, req: Request, res: Response, next: NextFunction) => void {
  return (err: any, req: Request, res: Response, _next: NextFunction) => {
    logger.error('unhandled error', { err: String(err), stack: err?.stack, url: req.originalUrl });
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.flatten() });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error' });
  };
}
