import { Router } from 'express';
import transactionsRouter from './transactions';
import categoriesRouter from './categories';
import dashboardRouter from './dashboard';
import savingsBoxesRouter from './savingsBoxes';
import reportsRouter from './reports';
import billsRouter from './bills';
import budgetsRouter from './budgets';
import assetsRouter from './assets';
import assetMovementsRouter from './assetMovements';
import authRouter from './auth';
import systemRouter from './system';
import { requireUser } from '../middlewares/auth';

const router = Router();

// Publicos
router.use('/auth', authRouter);
router.use('/system', systemRouter);

// Health check (publico)
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Autenticados
router.use('/transactions', requireUser, transactionsRouter);
router.use('/categories', requireUser, categoriesRouter);
router.use('/dashboard', requireUser, dashboardRouter);
router.use('/savings-boxes', requireUser, savingsBoxesRouter);
router.use('/reports', requireUser, reportsRouter);
router.use('/bills', requireUser, billsRouter);
router.use('/budgets', requireUser, budgetsRouter);
router.use('/assets', requireUser, assetsRouter);
router.use('/asset-movements', requireUser, assetMovementsRouter);

export default router;
