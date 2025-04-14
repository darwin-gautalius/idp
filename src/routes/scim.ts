import { Router, Request, Response } from 'express';
import { findUserById, getAllUsers } from '../db/users';
import { User, ScimUser, ScimListResponse, ScimError } from '../types';

const router = Router();

// SCIM User Schema
function mapUserToScim(user: User): ScimUser {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: user.id,
    userName: user.email,
    name: {
      givenName: user.firstName,
      familyName: user.lastName
    },
    emails: [{
      primary: true,
      value: user.email,
      type: 'work'
    }],
    active: true,
    groups: [{
      value: user.role,
      display: user.role
    }]
  };
}

// List users
router.get('/Users', function(req: Request, res: Response) {
  const users = getAllUsers();
  const startIndex = parseInt(req.query.startIndex as string) || 1;
  const count = parseInt(req.query.count as string) || users.length;
  const slicedUsers = users.slice(startIndex - 1, startIndex - 1 + count);

  const response: ScimListResponse = {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: users.length,
    startIndex: startIndex,
    itemsPerPage: count,
    Resources: slicedUsers.map(mapUserToScim)
  };

  res.json(response);
});

// Get user by ID
router.get('/Users/:id', function(req: Request, res: Response) {
  const user = findUserById(req.params.id);
  if (!user) {
    const error: ScimError = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'User not found'
    };
    return res.status(404).json(error);
  }
  res.json(mapUserToScim(user));
});

// Search users
router.post('/Users/.search', function(req: Request, res: Response) {
  const users = getAllUsers();
  const response: ScimListResponse = {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: users.length,
    Resources: users.map(mapUserToScim)
  };
  res.json(response);
});

export default router; 