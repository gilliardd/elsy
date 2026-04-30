import { Request, Response } from 'express';
import {
  getBudgetByMonth,
  getAllBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  createBudgetItem,
  updateBudgetItem,
  deleteBudgetItem,
  getBudgetSummary,
  copyBudgetFromPrevious,
  BUDGET_RULES,
  type BudgetRule,
  type BudgetCategory,
} from '../models/Budget';

export async function list(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const budgets = await getAllBudgets(userId);
    res.json({ success: true, data: budgets });
  } catch (error) {
    console.error('Erro ao listar orcamentos:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar orcamentos' });
  }
}

export async function getByMonth(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { year, month } = req.params;
    const budget = await getBudgetByMonth(userId, Number(year), Number(month));

    if (!budget) {
      res.status(404).json({ success: false, error: 'Orcamento nao encontrado' });
      return;
    }

    res.json({ success: true, data: budget });
  } catch (error) {
    console.error('Erro ao buscar orcamento:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar orcamento' });
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { year, month, rule, expected_income, custom_necessidades, custom_estilo_vida, custom_futuro } = req.body;

    if (!year || !month || !rule || expected_income === undefined) {
      res.status(400).json({
        success: false,
        error: 'Ano, mes, regra e renda prevista sao obrigatorios',
      });
      return;
    }

    const validRules = ['50-30-20', '60-20-20', '40-30-30', 'custom'];
    if (!validRules.includes(rule)) {
      res.status(400).json({
        success: false,
        error: 'Regra invalida. Use: 50-30-20, 60-20-20, 40-30-30 ou custom',
      });
      return;
    }

    if (rule === 'custom') {
      if (custom_necessidades === undefined || custom_estilo_vida === undefined || custom_futuro === undefined) {
        res.status(400).json({
          success: false,
          error: 'Percentuais customizados sao obrigatorios para regra personalizada',
        });
        return;
      }

      const total = Number(custom_necessidades) + Number(custom_estilo_vida) + Number(custom_futuro);
      if (total !== 100) {
        res.status(400).json({
          success: false,
          error: `Os percentuais devem somar 100%. Atual: ${total}%`,
        });
        return;
      }
    }

    const existing = await getBudgetByMonth(userId, Number(year), Number(month));
    if (existing) {
      res.status(400).json({
        success: false,
        error: 'Ja existe um orcamento para este mes',
      });
      return;
    }

    const id = await createBudget(userId, {
      year: Number(year),
      month: Number(month),
      rule: rule as BudgetRule,
      expected_income: Number(expected_income),
      custom_necessidades: rule === 'custom' ? Number(custom_necessidades) : undefined,
      custom_estilo_vida: rule === 'custom' ? Number(custom_estilo_vida) : undefined,
      custom_futuro: rule === 'custom' ? Number(custom_futuro) : undefined,
    });

    res.status(201).json({ success: true, data: { id } });
  } catch (error) {
    console.error('Erro ao criar orcamento:', error);
    res.status(500).json({ success: false, error: 'Erro ao criar orcamento' });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { year, month } = req.params;
    const { rule, expected_income, custom_necessidades, custom_estilo_vida, custom_futuro } = req.body;

    const budget = await getBudgetByMonth(userId, Number(year), Number(month));
    if (!budget) {
      res.status(404).json({ success: false, error: 'Orcamento nao encontrado' });
      return;
    }

    if (rule) {
      const validRules = ['50-30-20', '60-20-20', '40-30-30', 'custom'];
      if (!validRules.includes(rule)) {
        res.status(400).json({
          success: false,
          error: 'Regra invalida. Use: 50-30-20, 60-20-20, 40-30-30 ou custom',
        });
        return;
      }

      if (rule === 'custom') {
        if (custom_necessidades === undefined || custom_estilo_vida === undefined || custom_futuro === undefined) {
          res.status(400).json({
            success: false,
            error: 'Percentuais customizados sao obrigatorios para regra personalizada',
          });
          return;
        }

        const total = Number(custom_necessidades) + Number(custom_estilo_vida) + Number(custom_futuro);
        if (total !== 100) {
          res.status(400).json({
            success: false,
            error: `Os percentuais devem somar 100%. Atual: ${total}%`,
          });
          return;
        }
      }
    }

    await updateBudget(userId, budget.id, {
      rule: rule as BudgetRule,
      expected_income: expected_income !== undefined ? Number(expected_income) : undefined,
      custom_necessidades: rule === 'custom' ? Number(custom_necessidades) : undefined,
      custom_estilo_vida: rule === 'custom' ? Number(custom_estilo_vida) : undefined,
      custom_futuro: rule === 'custom' ? Number(custom_futuro) : undefined,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar orcamento:', error);
    res.status(500).json({ success: false, error: 'Erro ao atualizar orcamento' });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { year, month } = req.params;

    const budget = await getBudgetByMonth(userId, Number(year), Number(month));
    if (!budget) {
      res.status(404).json({ success: false, error: 'Orcamento nao encontrado' });
      return;
    }

    await deleteBudget(userId, budget.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir orcamento:', error);
    res.status(500).json({ success: false, error: 'Erro ao excluir orcamento' });
  }
}

export async function addItem(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { year, month } = req.params;
    const { category, name, planned_amount } = req.body;

    if (!category || !name || planned_amount === undefined) {
      res.status(400).json({
        success: false,
        error: 'Categoria, nome e valor planejado sao obrigatorios',
      });
      return;
    }

    const validCategories: BudgetCategory[] = ['necessidades', 'estilo_vida', 'futuro'];
    if (!validCategories.includes(category)) {
      res.status(400).json({
        success: false,
        error: 'Categoria invalida. Use: necessidades, estilo_vida ou futuro',
      });
      return;
    }

    const budget = await getBudgetByMonth(userId, Number(year), Number(month));
    if (!budget) {
      res.status(404).json({ success: false, error: 'Orcamento nao encontrado' });
      return;
    }

    const id = await createBudgetItem(userId, {
      budget_id: budget.id,
      category: category as BudgetCategory,
      name,
      planned_amount: Number(planned_amount),
    });

    res.status(201).json({ success: true, data: { id } });
  } catch (error) {
    console.error('Erro ao adicionar item:', error);
    res.status(500).json({ success: false, error: 'Erro ao adicionar item' });
  }
}

export async function updateItem(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { itemId } = req.params;
    const { category, name, planned_amount } = req.body;

    if (category) {
      const validCategories: BudgetCategory[] = ['necessidades', 'estilo_vida', 'futuro'];
      if (!validCategories.includes(category)) {
        res.status(400).json({
          success: false,
          error: 'Categoria invalida. Use: necessidades, estilo_vida ou futuro',
        });
        return;
      }
    }

    await updateBudgetItem(userId, Number(itemId), {
      category: category as BudgetCategory,
      name,
      planned_amount: planned_amount !== undefined ? Number(planned_amount) : undefined,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar item:', error);
    res.status(500).json({ success: false, error: 'Erro ao atualizar item' });
  }
}

export async function removeItem(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { itemId } = req.params;
    await deleteBudgetItem(userId, Number(itemId));
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover item:', error);
    res.status(500).json({ success: false, error: 'Erro ao remover item' });
  }
}

export async function summary(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { year, month } = req.params;

    const budget = await getBudgetByMonth(userId, Number(year), Number(month));
    if (!budget) {
      res.status(404).json({ success: false, error: 'Orcamento nao encontrado' });
      return;
    }

    const summaryData = await getBudgetSummary(userId, budget.id);
    res.json({ success: true, data: summaryData });
  } catch (error) {
    console.error('Erro ao obter resumo:', error);
    res.status(500).json({ success: false, error: 'Erro ao obter resumo' });
  }
}

export async function copyFromPrevious(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { year, month } = req.params;
    const targetYear = Number(year);
    const targetMonth = Number(month);

    const existing = await getBudgetByMonth(userId, targetYear, targetMonth);
    if (existing) {
      res.status(400).json({
        success: false,
        error: 'Ja existe um orcamento para este mes',
      });
      return;
    }

    let fromYear = targetYear;
    let fromMonth = targetMonth - 1;
    if (fromMonth < 1) {
      fromMonth = 12;
      fromYear -= 1;
    }

    const newBudgetId = await copyBudgetFromPrevious(userId, fromYear, fromMonth, targetYear, targetMonth);

    if (!newBudgetId) {
      res.status(404).json({
        success: false,
        error: 'Nao existe orcamento do mes anterior para copiar',
      });
      return;
    }

    res.status(201).json({ success: true, data: { id: newBudgetId } });
  } catch (error) {
    console.error('Erro ao copiar orcamento:', error);
    res.status(500).json({ success: false, error: 'Erro ao copiar orcamento' });
  }
}

export async function getRules(req: Request, res: Response): Promise<void> {
  try {
    const rules = Object.entries(BUDGET_RULES).map(([key, value]) => ({
      id: key,
      name: key.replace(/-/g, ' / '),
      necessidades: value.necessidades,
      estilo_vida: value.estilo_vida,
      futuro: value.futuro,
    }));

    rules.push({
      id: 'custom',
      name: 'Personalizado',
      necessidades: 0,
      estilo_vida: 0,
      futuro: 0,
    });

    res.json({ success: true, data: rules });
  } catch (error) {
    console.error('Erro ao obter regras:', error);
    res.status(500).json({ success: false, error: 'Erro ao obter regras' });
  }
}
