import { AuthService } from './authService';
import { MemoryUserRepository } from '../storage/memory';

describe('AuthService', () => {
  it('registers, logs in, and verifies tokens', async () => {
    const repo = new MemoryUserRepository();
    const svc = new AuthService(repo);
    await svc.register('alice', 'password123', 'admin');

    const bad = await svc.login('alice', 'wrong');
    expect(bad).toBeNull();

    const good = await svc.login('alice', 'password123');
    expect(good).not.toBeNull();
    expect(good!.user.username).toBe('alice');
    expect(good!.user.role).toBe('admin');

    const payload = svc.verifyToken(good!.token);
    expect(payload?.username).toBe('alice');
  });

  it('ensureAdmin is idempotent', async () => {
    const repo = new MemoryUserRepository();
    const svc = new AuthService(repo);
    const a = await svc.ensureAdmin('admin', 'admin');
    const b = await svc.ensureAdmin('admin', 'admin');
    expect(a.id).toBe(b.id);
  });
});
