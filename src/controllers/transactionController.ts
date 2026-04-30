import { Request, Response } from 'express';
import {
  createTransaction,
  getTransactions,
  getTransactionById,
  getMonthSummary,
  getRecentTransactions,
} from '../models/Transaction';

export async function listTransactions(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { type, startDate, endDate, category_id, limit } = req.query;

    const transactions = await getTransactions(userId, {
      type: type as 'income' | 'expense' | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      category_id: category_id ? parseInt(category_id as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Erro ao listar transacoes:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar transacoes' });
  }
}

export async function getTransaction(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const transaction = await getTransactionById(userId, parseInt(id));

    if (!transaction) {
      res.status(404).json({ success: false, error: 'Transacao nao encontrada' });
      return;
    }

    res.json({ success: true, data: transaction });
  } catch (error) {
    console.error('Erro ao buscar transacao:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar transacao' });
  }
}

export async function addTransaction(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { type, amount, description, category_id, date, notes, source } = req.body;

    if (!type || !amount || !category_id || !date) {
      res.status(400).json({ success: false, error: 'Campos obrigatorios: type, amount, category_id, date' });
      return;
    }

    const id = await createTransaction(userId, {
      type,
      amount,
      description,
      category_id,
      date,
      notes,
      source: source || 'manual',
    });

    res.status(201).json({ success: true, data: { id } });
  } catch (error) {
    console.error('Erro ao criar transacao:', error);
    res.status(500).json({ success: false, error: 'Erro ao criar transacao' });
  }
}

export async function getSummary(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { year, month } = req.query;

    const now = new Date();
    const y = year ? parseInt(year as string) : now.getFullYear();
    const m = month ? parseInt(month as string) : now.getMonth() + 1;

    const summary = await getMonthSummary(userId, y, m);

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Erro ao buscar resumo:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar resumo' });
  }
}

export async function getRecent(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { limit } = req.query;
    const transactions = await getRecentTransactions(userId, limit ? parseInt(limit as string) : 10);

    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Erro ao buscar transacoes recentes:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar transacoes' });
  }
}
