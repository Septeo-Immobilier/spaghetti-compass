/**
 * Authentication service
 */

import { User } from '../models/user.js';
import { UserService } from './user-service.js';

export class AuthService {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async authenticate(email: string, password: string): Promise<User | null> {
    // Simplified auth - in real app would check password
    const users = await this.userService.getAll();
    return users.find((u) => u.email === email) || null;
  }

  async register(email: string, name: string, password: string): Promise<User> {
    return this.userService.create(email, name);
  }
}
