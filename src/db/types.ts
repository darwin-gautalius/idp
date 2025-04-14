export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'REVIEWER' | 'LABELER';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}
