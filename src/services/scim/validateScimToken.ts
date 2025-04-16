import { Request, Response, NextFunction } from 'express';
import { ScimError } from './services/scim/types';

// SCIM Bearer token middleware
export function validateScimToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const error: ScimError = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Unauthorized'
    };
    return res.status(401).json(error);
  }
  const token = authHeader.split(' ')[1];
  if (token !== process.env.SCIM_TOKEN) {
    const error: ScimError = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Invalid token'
    };
    return res.status(401).json(error);
  }
  next();
}
