import { describe, it, expect, vi } from 'vitest';
import { Request, Response } from 'express';
import { requireUser } from '../../src/middlewares/auth';

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

describe('requireUser middleware', () => {
  it('rejeita request sem header Authorization', () => {
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();

    requireUser(req, res, next);

    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(req.userId).toBeUndefined();
  });

  it('rejeita header sem prefixo Bearer', () => {
    const req = makeReq('abcdef');
    const res = makeRes();
    const next = vi.fn();

    requireUser(req, res, next);

    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejeita token base64 sem userId valido', () => {
    const token = Buffer.from('lixo:lixo:lixo').toString('base64');
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();
    const next = vi.fn();

    requireUser(req, res, next);

    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('aceita token valido e popula req.userId', () => {
    const token = Buffer.from('42:admin:1700000000000').toString('base64');
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();
    const next = vi.fn();

    requireUser(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBe(42);
    expect(res._status).toBeUndefined();
  });

  it('rejeita userId zero ou negativo', () => {
    const token = Buffer.from('0:admin:1700000000000').toString('base64');
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();
    const next = vi.fn();

    requireUser(req, res, next);

    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
