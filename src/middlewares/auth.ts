import { Request, Response, NextFunction } from 'express';
import { verifyToken, type UserRole } from '../utils/jwt';

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      userRole?: UserRole;
    }
  }
}

function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7).trim() || null;
}

// Decodifica o JWT e popula req.userId / req.userRole. NAO bloqueia
// se nao houver token — outros middlewares (requireUser/requireAdmin)
// fazem o bloqueio quando necessario.
export function decodeAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req.headers.authorization);
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.userId = payload.userId;
      req.userRole = payload.role;
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.userId || !req.userRole) {
    res.status(401).json({ success: false, error: 'Nao autenticado' });
    return;
  }
  next();
}

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.userId || !req.userRole) {
    res.status(401).json({ success: false, error: 'Nao autenticado' });
    return;
  }
  if (req.userRole !== 'user' && req.userRole !== 'admin') {
    res.status(403).json({ success: false, error: 'Acesso negado' });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.userId || !req.userRole) {
    res.status(401).json({ success: false, error: 'Nao autenticado' });
    return;
  }
  if (req.userRole !== 'admin') {
    res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
    return;
  }
  next();
}
