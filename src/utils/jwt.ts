import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export type UserRole = 'admin' | 'user' | 'viewer';

export interface JwtPayload {
  userId: number;
  role: UserRole;
}

export function signToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: env.jwt.expiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.jwt.secret, options);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.jwt.secret) as JwtPayload & { iat: number; exp: number };
    if (typeof decoded.userId !== 'number' || !decoded.role) return null;
    return { userId: decoded.userId, role: decoded.role };
  } catch {
    return null;
  }
}
