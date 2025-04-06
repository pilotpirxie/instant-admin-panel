import { Request } from 'express';

interface ExtendedRequest extends Request {
  userId?: number;
}

declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}
