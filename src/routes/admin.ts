import { Router } from 'express';
import { requireAdmin } from '../middlewares/auth';
import { getMessagingClient } from '../messaging';
import {
  listPlans,
  createNewPlan,
  updateExistingPlan,
  removeExistingPlan,
  listUsers,
  getUserDetail,
  grantCortesia,
  extendTrial,
  blockUser,
  unblockUser,
  getSystemConfig,
  setSystemConfig,
  deleteSystemConfig,
  getUserMessages,
} from '../controllers/adminController';

const router = Router();

router.use(requireAdmin);

// ------------------------------------------------------------
// WhatsApp
// ------------------------------------------------------------
router.get('/whatsapp/status', (req, res) => {
  const client = getMessagingClient();
  res.json({
    success: true,
    data: {
      status: client.status(),
      connectedPhone: client.connectedPhone(),
      qrAvailable: client.currentQrDataUrl() !== null,
    },
  });
});

router.get('/whatsapp/qr', (req, res) => {
  const client = getMessagingClient();
  const qr = client.currentQrDataUrl();
  if (!qr) {
    res.status(404).json({ success: false, error: 'QR code nao disponivel no momento' });
    return;
  }
  res.json({ success: true, data: { qr } });
});

router.post('/whatsapp/reconnect', async (req, res) => {
  try {
    const client = getMessagingClient();
    await client.stop();
    await client.start();
    res.json({ success: true, data: { status: client.status() } });
  } catch (err: any) {
    console.error('Erro ao reconectar WhatsApp:', err);
    res.status(500).json({ success: false, error: 'Erro ao reconectar' });
  }
});

// ------------------------------------------------------------
// Plans
// ------------------------------------------------------------
router.get('/plans', listPlans);
router.post('/plans', createNewPlan);
router.put('/plans/:id', updateExistingPlan);
router.delete('/plans/:id', removeExistingPlan);

// ------------------------------------------------------------
// Users
// ------------------------------------------------------------
router.get('/users', listUsers);
router.get('/users/:id', getUserDetail);
router.get('/users/:id/messages', getUserMessages);
router.post('/users/:id/cortesia', grantCortesia);
router.post('/users/:id/extend-trial', extendTrial);
router.post('/users/:id/block', blockUser);
router.post('/users/:id/unblock', unblockUser);

// ------------------------------------------------------------
// System config (Asaas, SMTP, OpenAI, etc.)
// ------------------------------------------------------------
router.get('/system-config', getSystemConfig);
router.put('/system-config/:key', setSystemConfig);
router.delete('/system-config/:key', deleteSystemConfig);

export default router;
