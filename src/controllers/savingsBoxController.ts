import { Request, Response } from 'express';
import {
  getAllSavingsBoxes,
  getSavingsBoxById,
  getSavingsBoxByName,
  createSavingsBox,
  deposit,
  withdraw,
  getBoxTransactions,
  deleteSavingsBox,
  getTotalSaved,
} from '../models/SavingsBox';

export async function listSavingsBoxes(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const boxes = await getAllSavingsBoxes(userId);
    const total = await getTotalSaved(userId);
    res.json({ success: true, data: { boxes, total } });
  } catch (error) {
    console.error('Erro ao listar caixinhas:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar caixinhas' });
  }
}

export async function getSavingsBox(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const box = await getSavingsBoxById(userId, parseInt(id));

    if (!box) {
      res.status(404).json({ success: false, error: 'Caixinha nao encontrada' });
      return;
    }

    const transactions = await getBoxTransactions(userId, box.id, 10);
    res.json({ success: true, data: { box, transactions } });
  } catch (error) {
    console.error('Erro ao buscar caixinha:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar caixinha' });
  }
}

export async function addSavingsBox(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { name, description, goal_amount, icon, color } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Nome e obrigatorio' });
      return;
    }

    const existing = await getSavingsBoxByName(userId, name);
    if (existing) {
      res.status(400).json({ success: false, error: 'Ja existe uma caixinha com esse nome' });
      return;
    }

    const id = await createSavingsBox(userId, { name, description, goal_amount, icon, color });
    res.status(201).json({ success: true, data: { id } });
  } catch (error) {
    console.error('Erro ao criar caixinha:', error);
    res.status(500).json({ success: false, error: 'Erro ao criar caixinha' });
  }
}

export async function depositToBox(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, error: 'Valor invalido' });
      return;
    }

    await deposit(userId, parseInt(id), amount, description);
    const box = await getSavingsBoxById(userId, parseInt(id));

    res.json({ success: true, data: box });
  } catch (error: any) {
    console.error('Erro ao depositar:', error);
    res.status(500).json({ success: false, error: error.message || 'Erro ao depositar' });
  }
}

export async function withdrawFromBox(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, error: 'Valor invalido' });
      return;
    }

    await withdraw(userId, parseInt(id), amount, description);
    const box = await getSavingsBoxById(userId, parseInt(id));

    res.json({ success: true, data: box });
  } catch (error: any) {
    console.error('Erro ao retirar:', error);
    res.status(400).json({ success: false, error: error.message || 'Erro ao retirar' });
  }
}

export async function removeSavingsBox(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    await deleteSavingsBox(userId, parseInt(id));
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir caixinha:', error);
    res.status(500).json({ success: false, error: 'Erro ao excluir caixinha' });
  }
}
