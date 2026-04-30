import { Router } from 'express';
import { requireAdmin } from '../middlewares/auth';
import { getMessagingClient } from '../messaging';

const router = Router();

router.use(requireAdmin);

// Status do WhatsApp
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

// QR code (Data URL PNG) — disponivel quando status = qr_required
router.get('/whatsapp/qr', (req, res) => {
  const client = getMessagingClient();
  const qr = client.currentQrDataUrl();
  if (!qr) {
    res.status(404).json({ success: false, error: 'QR code nao disponivel no momento' });
    return;
  }
  res.json({ success: true, data: { qr } });
});

// Forca reinicializacao da conexao (util quando sessao perde sincronia)
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

export default router;
