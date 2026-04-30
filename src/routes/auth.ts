import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  adminLogin,
  userLogin,
  signup,
  verifyPhone,
  resendOtp,
  forgotPassword,
  resetPassword,
  requestChangePhone,
  confirmChangePhone,
  me,
  updateMe,
} from '../controllers/authController';
import { requireAuth } from '../middlewares/auth';

const router = Router();

// Rate limit aplicado as rotas publicas: 20 requisicoes por minuto por IP.
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Muitas requisicoes. Tente novamente em instantes.' },
});

// Limite mais agressivo no login admin (proteção contra brute force).
const adminLoginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Muitas tentativas de login. Tente novamente em 1 minuto.' },
});

// ------------------------------------------------------------
// Publicos
// ------------------------------------------------------------
router.post('/admin/login', adminLoginLimiter, adminLogin);
router.post('/login', publicLimiter, userLogin);
router.post('/signup', publicLimiter, signup);
router.post('/verify-phone', publicLimiter, verifyPhone);
router.post('/resend-otp', publicLimiter, resendOtp);
router.post('/forgot-password', publicLimiter, forgotPassword);
router.post('/reset-password', publicLimiter, resetPassword);

// ------------------------------------------------------------
// Autenticados
// ------------------------------------------------------------
router.get('/me', requireAuth, me);
router.put('/profile', requireAuth, updateMe);
router.post('/change-phone', requireAuth, requestChangePhone);
router.post('/confirm-change-phone', requireAuth, confirmChangePhone);

export default router;
