import { Router } from 'express';
import {
  createUserSubscription,
  getMySubscription,
  cancelMySubscription,
  reactivateMySubscription,
  listMySubscriptions,
} from '../controllers/subscriptionController';
import { requireAuth } from '../middlewares/auth';

const router = Router();

router.use(requireAuth);

router.post('/', createUserSubscription);
router.get('/me', getMySubscription);
router.get('/history', listMySubscriptions);
router.post('/cancel', cancelMySubscription);
router.post('/reactivate', reactivateMySubscription);

export default router;
