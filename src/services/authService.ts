import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { User } from '../domain/types';
import { UserRepository } from '../storage/repository';
import { config } from '../config';

/**
 * Authentication service.
 *
 * Uses scrypt for password hashing (built into Node crypto) and JWT for
 * session tokens. Roles are checked in the auth middleware.
 */
export class AuthService {
  constructor(private readonly users: UserRepository) {}

  async ensureAdmin(username = 'admin', password = 'admin'): Promise<User> {
    const existing = await this.users.findByUsername(username);
    if (existing) return existing;
    return this.register(username, password, 'admin');
  }

  async register(username: string, password: string, role: User['role']): Promise<User> {
    const user: User = {
      id: uuid(),
      username,
      passwordHash: this.hashPassword(password),
      role,
    };
    return this.users.create(user);
  }

  async login(username: string, password: string): Promise<{ token: string; user: Omit<User, 'passwordHash'> } | null> {
    const user = await this.users.findByUsername(username);
    if (!user) return null;
    if (!this.verifyPassword(password, user.passwordHash)) return null;
    const token = jwt.sign(
      { sub: user.id, username: user.username, role: user.role },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn } as jwt.SignOptions,
    );
    const { passwordHash: _ph, ...safe } = user;
    return { token, user: safe };
  }

  verifyToken(token: string): { sub: string; username: string; role: User['role'] } | null {
    try {
      return jwt.verify(token, config.jwtSecret) as any;
    } catch {
      return null;
    }
  }

  private hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, stored: string): boolean {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    // Constant-time comparison to prevent timing attacks.
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(derived, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}
