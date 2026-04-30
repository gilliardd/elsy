import { Router } from 'express';
import { listPublicPlans } from '../controllers/subscriptionController';

const router = Router();

// Sem auth: usado pela landing/signup para listar opcoes de plano.
router.get('/plans', listPublicPlans);

export default router;
