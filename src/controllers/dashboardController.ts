import { Request, Response } from 'express';
import { getDateRangeSummary, getRecentTransactionsByDateRange } from '../models/Transaction';
import { query } from '../config/database';
import { getAllSavingsBoxes, getTotalSaved } from '../models/SavingsBox';

export async function getDashboard(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { startDate: queryStartDate, endDate: queryEndDate } = req.query;

    let startDate: string;
    let endDate: string;

    if (queryStartDate && queryEndDate) {
      startDate = queryStartDate as string;
      endDate = queryEndDate as string;
    } else {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      endDate = new Date(year, month, 0).toISOString().split('T')[0];
    }

    const summary = await getDateRangeSummary(userId, startDate, endDate);
    const recentTransactions = await getRecentTransactionsByDateRange(userId, startDate, endDate, 10);

    const expensesByCategory = await query<{ category: string; total: number; color: string }[]>(
      `SELECT c.name as category, c.color, COALESCE(SUM(t.amount), 0) as total
       FROM categories c
       LEFT JOIN transactions t ON t.category_id = c.id AND t.user_id = ? AND t.type = 'expense' AND t.date BETWEEN ? AND ?
       WHERE c.user_id = ? AND c.type = 'expense' AND c.is_active = true
       GROUP BY c.id, c.name, c.color
       HAVING total > 0
       ORDER BY total DESC`,
      [userId, startDate, endDate, userId]
    );

    const savingsBoxes = await getAllSavingsBoxes(userId);
    const totalSaved = await getTotalSaved(userId);

    res.json({
      success: true,
      data: {
        summary,
        recentTransactions,
        expensesByCategory,
        savingsBoxes: {
          count: savingsBoxes.length,
          totalSaved,
          boxes: savingsBoxes.map((box) => ({
            id: box.id,
            name: box.name,
            currentAmount: Number(box.current_amount),
            goalAmount: Number(box.goal_amount),
            icon: box.icon,
            color: box.color,
            progress: box.goal_amount > 0 ? Math.min(100, (Number(box.current_amount) / Number(box.goal_amount)) * 100) : 0,
          })),
        },
        period: { startDate, endDate },
      },
    });
  } catch (error) {
    console.error('Erro ao buscar dashboard:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar dashboard' });
  }
}
