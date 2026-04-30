import { Request, Response } from 'express';
import { query } from '../config/database';

export async function getReportsByCategory(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { startDate, endDate, type } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({ success: false, error: 'startDate e endDate sao obrigatorios' });
      return;
    }

    let typeFilter = '';
    const params: any[] = [userId, startDate, endDate, userId];

    if (type && (type === 'income' || type === 'expense')) {
      typeFilter = 'AND t.type = ?';
      params.push(type);
    }

    const data = await query<{
      category_id: number;
      category: string;
      type: string;
      color: string;
      icon: string;
      total: number;
      count: number;
    }[]>(
      `SELECT
        c.id as category_id,
        c.name as category,
        c.type,
        c.color,
        c.icon,
        COALESCE(SUM(t.amount), 0) as total,
        COUNT(t.id) as count
       FROM categories c
       LEFT JOIN transactions t ON t.category_id = c.id AND t.user_id = ? AND t.date BETWEEN ? AND ? ${typeFilter}
       WHERE c.user_id = ? AND c.is_active = true
       GROUP BY c.id, c.name, c.type, c.color, c.icon
       HAVING total > 0
       ORDER BY total DESC`,
      params
    );

    const totals = {
      income: data.filter(d => d.type === 'income').reduce((sum, d) => sum + Number(d.total), 0),
      expense: data.filter(d => d.type === 'expense').reduce((sum, d) => sum + Number(d.total), 0),
    };

    res.json({
      success: true,
      data: {
        categories: data.map(d => ({
          ...d,
          total: Number(d.total),
          count: Number(d.count),
          percentage: d.type === 'income'
            ? (totals.income > 0 ? (Number(d.total) / totals.income) * 100 : 0)
            : (totals.expense > 0 ? (Number(d.total) / totals.expense) * 100 : 0),
        })),
        totals,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar relatorio por categoria:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar relatorio' });
  }
}

export async function getReportsByPeriod(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { startDate, endDate, groupBy = 'day' } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({ success: false, error: 'startDate e endDate sao obrigatorios' });
      return;
    }

    let dateFormat: string;
    let groupByClause: string;

    switch (groupBy) {
      case 'week':
        dateFormat = '%Y-%u';
        groupByClause = 'YEARWEEK(t.date)';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        groupByClause = 'DATE_FORMAT(t.date, "%Y-%m")';
        break;
      case 'year':
        dateFormat = '%Y';
        groupByClause = 'YEAR(t.date)';
        break;
      default:
        dateFormat = '%Y-%m-%d';
        groupByClause = 'DATE(t.date)';
    }

    const data = await query<{
      period: string;
      income: number;
      expense: number;
    }[]>(
      `SELECT
        DATE_FORMAT(t.date, '${dateFormat}') as period,
        COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as expense
       FROM transactions t
       WHERE t.user_id = ? AND t.date BETWEEN ? AND ?
       GROUP BY ${groupByClause}
       ORDER BY period ASC`,
      [userId, startDate, endDate]
    );

    res.json({
      success: true,
      data: data.map(d => ({
        period: d.period,
        income: Number(d.income),
        expense: Number(d.expense),
        balance: Number(d.income) - Number(d.expense),
      })),
    });
  } catch (error) {
    console.error('Erro ao buscar relatorio por periodo:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar relatorio' });
  }
}

export async function getTransactionsList(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { startDate, endDate, type, category_id, limit = 100, offset = 0 } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({ success: false, error: 'startDate e endDate sao obrigatorios' });
      return;
    }

    let filters = 't.user_id = ? AND t.date BETWEEN ? AND ?';
    const params: any[] = [userId, startDate, endDate];

    if (type && (type === 'income' || type === 'expense')) {
      filters += ' AND t.type = ?';
      params.push(type);
    }

    if (category_id) {
      filters += ' AND t.category_id = ?';
      params.push(category_id);
    }

    const countResult = await query<{ total: number }[]>(
      `SELECT COUNT(*) as total FROM transactions t WHERE ${filters}`,
      params
    );

    const transactions = await query<{
      id: number;
      type: string;
      amount: number;
      description: string;
      date: string;
      category_id: number;
      category_name: string;
      category_color: string;
    }[]>(
      `SELECT
        t.id,
        t.type,
        t.amount,
        t.description,
        t.date,
        t.category_id,
        c.name as category_name,
        c.color as category_color
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE ${filters}
       ORDER BY t.date DESC, t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    res.json({
      success: true,
      data: {
        transactions: transactions.map(t => ({
          ...t,
          amount: Number(t.amount),
        })),
        total: Number(countResult[0]?.total || 0),
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error) {
    console.error('Erro ao buscar transacoes:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar transacoes' });
  }
}

export async function getReportsSummary(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({ success: false, error: 'startDate e endDate sao obrigatorios' });
      return;
    }

    const totals = await query<{ type: string; total: number; count: number }[]>(
      `SELECT
        type,
        COALESCE(SUM(amount), 0) as total,
        COUNT(*) as count
       FROM transactions
       WHERE user_id = ? AND date BETWEEN ? AND ?
       GROUP BY type`,
      [userId, startDate, endDate]
    );

    const income = totals.find(t => t.type === 'income');
    const expense = totals.find(t => t.type === 'expense');

    const biggestExpense = await query<{
      amount: number;
      description: string;
      category_name: string;
      date: string;
    }[]>(
      `SELECT t.amount, t.description, c.name as category_name, t.date
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = ? AND t.type = 'expense' AND t.date BETWEEN ? AND ?
       ORDER BY t.amount DESC
       LIMIT 1`,
      [userId, startDate, endDate]
    );

    const biggestIncome = await query<{
      amount: number;
      description: string;
      category_name: string;
      date: string;
    }[]>(
      `SELECT t.amount, t.description, c.name as category_name, t.date
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = ? AND t.type = 'income' AND t.date BETWEEN ? AND ?
       ORDER BY t.amount DESC
       LIMIT 1`,
      [userId, startDate, endDate]
    );

    const topExpenseCategory = await query<{
      category: string;
      color: string;
      total: number;
    }[]>(
      `SELECT c.name as category, c.color, SUM(t.amount) as total
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = ? AND t.type = 'expense' AND t.date BETWEEN ? AND ?
       GROUP BY c.id, c.name, c.color
       ORDER BY total DESC
       LIMIT 1`,
      [userId, startDate, endDate]
    );

    const daysDiff = Math.ceil(
      (new Date(endDate as string).getTime() - new Date(startDate as string).getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    const incomeTotal = Number(income?.total || 0);
    const expenseTotal = Number(expense?.total || 0);

    res.json({
      success: true,
      data: {
        income: {
          total: incomeTotal,
          count: Number(income?.count || 0),
          average: daysDiff > 0 ? incomeTotal / daysDiff : 0,
          biggest: biggestIncome[0] ? {
            ...biggestIncome[0],
            amount: Number(biggestIncome[0].amount),
          } : null,
        },
        expense: {
          total: expenseTotal,
          count: Number(expense?.count || 0),
          average: daysDiff > 0 ? expenseTotal / daysDiff : 0,
          biggest: biggestExpense[0] ? {
            ...biggestExpense[0],
            amount: Number(biggestExpense[0].amount),
          } : null,
          topCategory: topExpenseCategory[0] ? {
            ...topExpenseCategory[0],
            total: Number(topExpenseCategory[0].total),
          } : null,
        },
        balance: incomeTotal - expenseTotal,
        transactionCount: Number(income?.count || 0) + Number(expense?.count || 0),
        daysInPeriod: daysDiff,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar resumo:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar resumo' });
  }
}
