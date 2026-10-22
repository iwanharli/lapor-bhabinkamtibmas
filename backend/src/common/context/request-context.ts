import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

/** Asal permintaan HTTP (IP & user-agent) yang ikut tercatat otomatis di audit log. */
export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const requestContext = () => storage.getStore();

export function requestContextMiddleware(req: Request, _res: Response, next: NextFunction) {
  storage.run({ ip: req.ip, userAgent: req.headers['user-agent'] }, next);
}
