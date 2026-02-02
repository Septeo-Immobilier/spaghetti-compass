/**
 * User service for managing users
 */

import { User } from '../models/user.js';
import { validateEmail } from '../utils/helpers.js';

export class UserService {
  private users: User[] = [];

  async getAll(): Promise<User[]> {
    return this.users;
  }

  async getById(id: string): Promise<User | undefined> {
    return this.users.find((u) => u.id === id);
  }

  async create(email: string, name: string): Promise<User> {
    if (!validateEmail(email)) {
      throw new Error('Invalid email');
    }
    const user: User = { id: crypto.randomUUID(), email, name };
    this.users.push(user);
    return user;
  }
}
