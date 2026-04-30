import { Request, Response } from 'express';
import {
  getAllBills,
  getBillById,
  createBill,
  updateBill,
  deleteBill,
  markBillAsPaid,
  getUpcomingBills,
  getMonthlyBillsTotal,
} from '../models/Bill';
import { createTransaction } from '../models/Transaction';

export async function list(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const bills = await getAllBills(userId);
    const total = await getMonthlyBillsTotal(userId);
    res.json({ success: true, data: { bills, total } });
  } catch (error) {
    console.error('Erro ao listar contas:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar contas' });
  }
}

export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const bill = await getBillById(userId, Number(id));

    if (!bill) {
      res.status(404).json({ success: false, error: 'Conta nao encontrada' });
      return;
    }

    res.json({ success: true, data: bill });
  } catch (error) {
    console.error('Erro ao buscar conta:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar conta' });
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { name, description, amount, due_day, category_id, is_recurring, repeat_months, reminder_days_before } = req.body;

    if (!name || !amount || !due_day) {
      res.status(400).json({ success: false, error: 'Nome, valor e dia de vencimento sao obrigatorios' });
      return;
    }

    if (due_day < 1 || due_day > 31) {
      res.status(400).json({ success: false, error: 'Dia de vencimento deve ser entre 1 e 31' });
      return;
    }

    const id = await createBill(userId, {
      name,
      description,
      amount: Number(amount),
      due_day: Number(due_day),
      category_id: category_id ? Number(category_id) : undefined,
      is_recurring,
      repeat_months: repeat_months !== undefined && repeat_months !== null ? Number(repeat_months) : null,
      reminder_days_before: reminder_days_before ? Number(reminder_days_before) : 1,
    });

    res.status(201).json({ success: true, data: { id } });
  } catch (error) {
    console.error('Erro ao criar conta:', error);
    res.status(500).json({ success: false, error: 'Erro ao criar conta' });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { name, description, amount, due_day, category_id, is_recurring, repeat_months, reminder_days_before } = req.body;

    const bill = await getBillById(userId, Number(id));
    if (!bill) {
      res.status(404).json({ success: false, error: 'Conta nao encontrada' });
      return;
    }

    if (due_day !== undefined && (due_day < 1 || due_day > 31)) {
      res.status(400).json({ success: false, error: 'Dia de vencimento deve ser entre 1 e 31' });
      return;
    }

    await updateBill(userId, Number(id), {
      name,
      description,
      amount: amount !== undefined ? Number(amount) : undefined,
      due_day: due_day !== undefined ? Number(due_day) : undefined,
      category_id: category_id !== undefined ? Number(category_id) : undefined,
      is_recurring,
      repeat_months: repeat_months !== undefined ? (repeat_months !== null ? Number(repeat_months) : null) : undefined,
      reminder_days_before: reminder_days_before !== undefined ? Number(reminder_days_before) : undefined,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar conta:', error);
    res.status(500).json({ success: false, error: 'Erro ao atualizar conta' });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const bill = await getBillById(userId, Number(id));
    if (!bill) {
      res.status(404).json({ success: false, error: 'Conta nao encontrada' });
      return;
    }

    await deleteBill(userId, Number(id));
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir conta:', error);
    res.status(500).json({ success: false, error: 'Erro ao excluir conta' });
  }
}

export async function markPaid(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { date } = req.body;

    const bill = await getBillById(userId, Number(id));
    if (!bill) {
      res.status(404).json({ success: false, error: 'Conta nao encontrada' });
      return;
    }

    const paidDate = date || new Date().toISOString().split('T')[0];
    await markBillAsPaid(userId, Number(id), paidDate);

    // Cria transacao de despesa automaticamente
    await createTransaction(userId, {
      type: 'expense',
      amount: bill.amount,
      description: bill.name,
      category_id: bill.category_id || 8,
      date: paidDate,
      notes: `Pagamento de conta - ${bill.description || ''}`,
      source: 'bill_payment',
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao marcar conta como paga:', error);
    res.status(500).json({ success: false, error: 'Erro ao marcar conta como paga' });
  }
}

export async function upcoming(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const days = req.query.days ? Number(req.query.days) : 7;
    const bills = await getUpcomingBills(userId, days);
    res.json({ success: true, data: bills });
  } catch (error) {
    console.error('Erro ao buscar contas proximas:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar contas proximas' });
  }
}
