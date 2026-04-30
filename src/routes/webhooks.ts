import { Router } from 'express';
import { asaasWebhook } from '../controllers/webhookController';

const router = Router();

router.post('/asaas', asaasWebhook);

export default router;
