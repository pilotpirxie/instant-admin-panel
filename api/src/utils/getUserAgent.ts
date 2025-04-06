import { Request } from 'express';

export function getUserAgent(req: Request): string {
  return req.headers['user-agent'] || '';
}