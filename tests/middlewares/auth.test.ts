import { describe, it, expect, vi } from 'vitest';
import { Request, Response } from 'express';
import { decodeAuth, requireAuth, requireAdmin, requireUser } from '../../src/middlewares/auth';
import { signToken } from '../../src/utils/jwt';

function makeReq(authHeader?: string): Request {
  return { headers: { authorization: authHeader } } as unknown as Request;
}

function makeRes() {
  const res: Partial<Response> & { _status?: number; _body?: any } = {};
  res.status = vi.fn((code: number) => {
    res._status = code;
    return res as Response;
  });
  res.json = vi.fn((body: any) => {
    res._body = body;
    return res as Response;
  });
  return res as Response & { _status?: number; _body?: any };
}

describe('decodeAuth', () => {
  it('nao popula req.userId sem header', () => {
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();
    decodeAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBeUndefined();
  });

  it('popula req.userId e req.userRole com JWT valido', () => {
    const token = signToken({ userId: 42, role: 'user' });
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();
    const next = vi.fn();
    decodeAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBe(42);
    expect(req.userRole).toBe('user');
  });

  it('ignora token invalido sem bloquear', () => {
    const req = makeReq('Bearer xxx.yyy.zzz');
    const res = makeRes();
    const next = vi.fn();
    decodeAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBeUndefined();
  });
});

describe('requireAuth', () => {
  it('rejeita sem userId', () => {
    const req = {} as Request;
    const res = makeRes();
    const next = vi.fn();
    requireAuth(req, res, next);
    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('passa com userId presente', () => {
    const req = { userId: 1, userRole: 'user' } as Request;
    const res = makeRes();
    const next = vi.fn();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('requireAdmin', () => {
  it('rejeita user comum com 403', () => {
    const req = { userId: 1, userRole: 'user' } as Request;
    const res = makeRes();
    const next = vi.fn();
    requireAdmin(req, res, next);
    expect(res._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('passa admin', () => {
    const req = { userId: 1, userRole: 'admin' } as Request;
    const res = makeRes();
    const next = vi.fn();
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('requireUser', () => {
  it('rejeita sem auth', () => {
    const req = {} as Request;
    const res = makeRes();
    const next = vi.fn();
    requireUser(req, res, next);
    expect(res._status).toBe(401);
  });

  it('passa user', () => {
    const req = { userId: 1, userRole: 'user' } as Request;
    const res = makeRes();
    const next = vi.fn();
    requireUser(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('passa admin (admin tem acesso de user)', () => {
    const req = { userId: 1, userRole: 'admin' } as Request;
    const res = makeRes();
    const next = vi.fn();
    requireUser(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejeita viewer com 403', () => {
    const req = { userId: 1, userRole: 'viewer' } as Request;
    const res = makeRes();
    const next = vi.fn();
    requireUser(req, res, next);
    expect(res._status).toBe(403);
  });
});
