/**
 * Main entry point for the application
 */

import { UserService } from './services/user-service.js';
import { AuthService } from './services/auth-service.js';
import { formatDate } from './utils/helpers.js';
import lodash from 'lodash';

export async function main(): Promise<void> {
  const userService = new UserService();
  const authService = new AuthService();

  console.log('Starting application...');
  console.log('Date:', formatDate(new Date()));

  const users = await userService.getAll();
  console.log('Users:', lodash.map(users, 'name'));
}

export const VERSION = '1.0.0';
