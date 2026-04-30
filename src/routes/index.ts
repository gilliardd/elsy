import { Router } from 'express';
import rateLimit from 'express-rate-limit';
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
import adminRouter from './admin';
import { decodeAuth, requireUser } from '../middlewares/auth';

const router = Router();

// Decodifica JWT em todas as requisicoes (nao bloqueia se ausente)
router.use(decodeAuth);

// Rate limit para rotas autenticadas: 100 reqs/min por usuario.
const authenticatedLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.userId ? `user:${req.userId}` : `ip:${req.ip}`),
  message: { success: false, error: 'Limite de requisicoes excedido. Tente novamente em instantes.' },
});

// Publicos
router.use('/auth', authRouter);
router.use('/system', systemRouter);

// Health check (publico)
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Admin (rotas exigem role admin via middleware do proprio router)
router.use('/admin', authenticatedLimiter, adminRouter);

// Autenticados
router.use('/transactions', requireUser, authenticatedLimiter, transactionsRouter);
router.use('/categories', requireUser, authenticatedLimiter, categoriesRouter);
router.use('/dashboard', requireUser, authenticatedLimiter, dashboardRouter);
router.use('/savings-boxes', requireUser, authenticatedLimiter, savingsBoxesRouter);
router.use('/reports', requireUser, authenticatedLimiter, reportsRouter);
router.use('/bills', requireUser, authenticatedLimiter, billsRouter);
router.use('/budgets', requireUser, authenticatedLimiter, budgetsRouter);
router.use('/assets', requireUser, authenticatedLimiter, assetsRouter);
router.use('/asset-movements', requireUser, authenticatedLimiter, assetMovementsRouter);

export default router;
