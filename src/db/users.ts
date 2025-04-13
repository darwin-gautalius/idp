import { User, UserRole } from '../types';

const users: User[] = [
  {
    id: '1',
    email: 'darwin+idp1@datasaur.ai',
    firstName: 'Darwin',
    lastName: 'One',
    role: 'ADMIN'
  },
  {
    id: '2',
    email: 'darwin+idp2@datasaur.ai',
    firstName: 'Darwin',
    lastName: 'Two',
    role: 'SUPERVISOR'
  },
  {
    id: '3',
    email: 'darwin+idp3@datasaur.ai',
    firstName: 'Darwin',
    lastName: 'Three',
    role: 'REVIEWER'
  },
  {
    id: '4',
    email: 'darwin+idp4@datasaur.ai',
    firstName: 'Darwin',
    lastName: 'Four',
    role: 'LABELER'
  },
  {
    id: '5',
    email: 'darwin+idp5@datasaur.ai',
    firstName: 'Darwin',
    lastName: 'Five',
    role: 'LABELER'
  }
];

function findUserByEmail(email: string): User | undefined {
  return users.find(function(user) {
    return user.email === email;
  });
}

function findUserById(id: string): User | undefined {
  return users.find(function(user) {
    return user.id === id;
  });
}

function getAllUsers(): User[] {
  return users;
}

export {
  users,
  findUserByEmail,
  findUserById,
  getAllUsers
}; 