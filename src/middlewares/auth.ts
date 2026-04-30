import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

// Decoder do token opaco atual (base64 "userId:username:timestamp").
// Sera substituido por JWT na Fase 2; por enquanto mantem compatibilidade
// com o token emitido por src/routes/auth.ts.
function decodeUserId(authHeader: string | undefined): number | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.substring(7);
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const userId = parseInt(decoded.split(':')[0], 10);
    return Number.isFinite(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
}

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  const userId = decodeUserId(req.headers.authorization);
  if (!userId) {
    res.status(401).json({ success: false, error: 'Nao autenticado' });
    return;
  }
  req.userId = userId;
  next();
}
