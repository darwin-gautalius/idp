export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'REVIEWER' | 'LABELER';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface ScimUser {
  schemas: string[];
  id: string;
  userName: string;
  name: {
    givenName: string;
    familyName: string;
  };
  emails: Array<{
    primary: boolean;
    value: string;
    type: string;
  }>;
  active: boolean;
  groups: Array<{
    value: string;
    display: string;
  }>;
}

export interface ScimListResponse {
  schemas: string[];
  totalResults: number;
  startIndex?: number;
  itemsPerPage?: number;
  Resources: ScimUser[];
}

export interface ScimError {
  schemas: string[];
  detail: string;
} 