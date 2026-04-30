import { Request, Response } from 'express';
import {
  getAllCategories,
  getCategoriesByType,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../models/Category';

export async function listCategories(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { type } = req.query;

    let categories;
    if (type && ['income', 'expense', 'investment'].includes(type as string)) {
      categories = await getCategoriesByType(userId, type as 'income' | 'expense' | 'investment');
    } else {
      categories = await getAllCategories(userId);
    }

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Erro ao listar categorias:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar categorias' });
  }
}

export async function getCategory(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const category = await getCategoryById(userId, parseInt(id));

    if (!category) {
      res.status(404).json({ success: false, error: 'Categoria nao encontrada' });
      return;
    }

    res.json({ success: true, data: category });
  } catch (error) {
    console.error('Erro ao buscar categoria:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar categoria' });
  }
}

export async function addCategory(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { name, type, icon, color } = req.body;

    if (!name || !type) {
      res.status(400).json({ success: false, error: 'Nome e tipo sao obrigatorios' });
      return;
    }

    if (!['income', 'expense', 'investment'].includes(type)) {
      res.status(400).json({ success: false, error: 'Tipo invalido' });
      return;
    }

    const id = await createCategory(userId, { name, type, icon, color });
    res.status(201).json({ success: true, data: { id } });
  } catch (error: any) {
    console.error('Erro ao criar categoria:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ success: false, error: 'Categoria ja existe' });
      return;
    }
    res.status(500).json({ success: false, error: 'Erro ao criar categoria' });
  }
}

export async function editCategory(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { name, icon, color } = req.body;

    await updateCategory(userId, parseInt(id), { name, icon, color });
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar categoria:', error);
    res.status(500).json({ success: false, error: 'Erro ao atualizar categoria' });
  }
}

export async function removeCategory(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    await deleteCategory(userId, parseInt(id));
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover categoria:', error);
    res.status(500).json({ success: false, error: 'Erro ao remover categoria' });
  }
}
