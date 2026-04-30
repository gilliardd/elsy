import { Request, Response } from 'express';
import {
  getAllMovements,
  getMovementById,
  getMovementsByAsset,
  getMovementsByDateRange,
  createMovement,
  updateMovement,
  deleteMovement,
  updateAllCurrentPrices,
  getMovementsSummary,
  getProfitByMonth,
  getProfitByType,
  getProfitByAsset,
  getPurchasesByAsset,
  getPurchasesByCategory,
  type CreateMovementData,
  type UpdateMovementData,
} from '../models/AssetMovement';
import { getAssetById } from '../models/Asset';

export async function listMovements(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { asset_id, start_date, end_date } = req.query;

    let movements;
    if (asset_id) {
      movements = await getMovementsByAsset(userId, Number(asset_id));
    } else if (start_date && end_date) {
      movements = await getMovementsByDateRange(
        userId,
        start_date as string,
        end_date as string
      );
    } else {
      movements = await getAllMovements(userId);
    }

    res.json(movements);
  } catch (error) {
    console.error('Erro ao listar movimentos:', error);
    res.status(500).json({ error: 'Erro ao listar movimentos' });
  }
}

export async function getMovement(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const movement = await getMovementById(userId, Number(id));

    if (!movement) {
      res.status(404).json({ error: 'Movimento nao encontrado' });
      return;
    }

    res.json(movement);
  } catch (error) {
    console.error('Erro ao buscar movimento:', error);
    res.status(500).json({ error: 'Erro ao buscar movimento' });
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const data: CreateMovementData = req.body;

    if (!data.asset_id || !data.date || !data.movement_type || !data.quantity || !data.price) {
      res.status(400).json({ error: 'Ativo, data, tipo, quantidade e preco sao obrigatorios' });
      return;
    }

    if (data.quantity <= 0) {
      res.status(400).json({ error: 'Quantidade deve ser maior que zero' });
      return;
    }

    if (data.price < 0) {
      res.status(400).json({ error: 'Preco nao pode ser negativo' });
      return;
    }

    const asset = await getAssetById(userId, data.asset_id);
    if (!asset) {
      res.status(400).json({ error: 'Ativo nao encontrado' });
      return;
    }

    const movement = await createMovement(userId, data);
    res.status(201).json(movement);
  } catch (error) {
    console.error('Erro ao criar movimento:', error);
    res.status(500).json({ error: 'Erro ao criar movimento' });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const data: UpdateMovementData = req.body;

    const existing = await getMovementById(userId, Number(id));
    if (!existing) {
      res.status(404).json({ error: 'Movimento nao encontrado' });
      return;
    }

    if (data.asset_id) {
      const asset = await getAssetById(userId, data.asset_id);
      if (!asset) {
        res.status(400).json({ error: 'Ativo nao encontrado' });
        return;
      }
    }

    const movement = await updateMovement(userId, Number(id), data);
    res.json(movement);
  } catch (error) {
    console.error('Erro ao atualizar movimento:', error);
    res.status(500).json({ error: 'Erro ao atualizar movimento' });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const existing = await getMovementById(userId, Number(id));
    if (!existing) {
      res.status(404).json({ error: 'Movimento nao encontrado' });
      return;
    }

    await deleteMovement(userId, Number(id));
    res.json({ message: 'Movimento removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover movimento:', error);
    res.status(500).json({ error: 'Erro ao remover movimento' });
  }
}

export async function updateCurrentPrice(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { assetId } = req.params;
    const { current_price } = req.body;

    if (current_price === undefined || current_price < 0) {
      res.status(400).json({ error: 'Preco atual e obrigatorio' });
      return;
    }

    await updateAllCurrentPrices(userId, Number(assetId), current_price);
    res.json({ message: 'Precos atualizados com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar precos:', error);
    res.status(500).json({ error: 'Erro ao atualizar precos' });
  }
}

export async function getSummary(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { start_date, end_date } = req.query;
    const summary = await getMovementsSummary(
      userId,
      start_date as string | undefined,
      end_date as string | undefined
    );
    res.json(summary);
  } catch (error) {
    console.error('Erro ao buscar resumo:', error);
    res.status(500).json({ error: 'Erro ao buscar resumo' });
  }
}

export async function getAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { start_date, end_date } = req.query;

    const [summary, byMonth, byType, byAsset, purchasesByAsset, purchasesByCategory] = await Promise.all([
      getMovementsSummary(userId, start_date as string | undefined, end_date as string | undefined),
      getProfitByMonth(userId, start_date as string | undefined, end_date as string | undefined),
      getProfitByType(userId, start_date as string | undefined, end_date as string | undefined),
      getProfitByAsset(userId, start_date as string | undefined, end_date as string | undefined),
      getPurchasesByAsset(userId, start_date as string | undefined, end_date as string | undefined),
      getPurchasesByCategory(userId, start_date as string | undefined, end_date as string | undefined),
    ]);

    res.json({
      summary,
      byMonth,
      byType,
      byAsset,
      purchasesByAsset,
      purchasesByCategory,
    });
  } catch (error) {
    console.error('Erro ao buscar analytics:', error);
    res.status(500).json({ error: 'Erro ao buscar analytics' });
  }
}
