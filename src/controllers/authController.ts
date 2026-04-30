import { Request, Response } from 'express';
import {
  authenticateAdmin,
  authenticateUser,
  getUserById,
  getUserByPhone,
  createUser,
  setPhoneVerified,
  updateProfile,
  updatePassword,
  updatePhone,
  verifyUserPasswordById,
  type CreateUserDTO,
} from '../models/User';
import { cloneTemplateCategoriesToUser } from '../models/Category';
import { signToken } from '../utils/jwt';
import { sendOtp, verifyOtp } from '../services/otpService';
import { normalizePhoneBR, normalizeCpf, isValidEmail, isStrongPassword } from '../utils/validators';

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function badRequest(res: Response, error: string) {
  res.status(400).json({ success: false, error });
}

function unauthorized(res: Response, error = 'Credenciais invalidas') {
  res.status(401).json({ success: false, error });
}

// ------------------------------------------------------------
// Login admin (username + senha)
// ------------------------------------------------------------

export async function adminLogin(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body || {};
  if (!username || !password) return badRequest(res, 'Username e senha sao obrigatorios');

  const user = await authenticateAdmin(username, password);
  if (!user) return unauthorized(res);

  const token = signToken({ userId: user.id, role: 'admin' });
  res.json({ success: true, data: { user, token } });
}

// ------------------------------------------------------------
// Login usuario (telefone + senha)
// ------------------------------------------------------------

export async function userLogin(req: Request, res: Response): Promise<void> {
  const { phone, password } = req.body || {};
  if (!phone || !password) return badRequest(res, 'Telefone e senha sao obrigatorios');

  const normalizedPhone = normalizePhoneBR(phone);
  if (!normalizedPhone) return badRequest(res, 'Telefone invalido');

  const user = await authenticateUser(normalizedPhone, password);
  if (!user) return unauthorized(res);

  if (!user.phone_verified) {
    return res.status(403).json({
      success: false,
      error: 'Telefone nao verificado',
      code: 'PHONE_NOT_VERIFIED',
    }) as any;
  }

  const token = signToken({ userId: user.id, role: 'user' });
  res.json({ success: true, data: { user, token } });
}

// ------------------------------------------------------------
// Signup
// ------------------------------------------------------------

export async function signup(req: Request, res: Response): Promise<void> {
  const { name, email, phone, password, cpf } = req.body || {};

  if (!name || !email || !phone || !password || !cpf) {
    return badRequest(res, 'Nome, email, telefone, senha e CPF sao obrigatorios');
  }
  if (!isValidEmail(email)) return badRequest(res, 'Email invalido');
  if (!isStrongPassword(password)) {
    return badRequest(res, 'Senha deve ter ao menos 8 caracteres com letras e numeros');
  }

  const normalizedPhone = normalizePhoneBR(phone);
  if (!normalizedPhone) return badRequest(res, 'Telefone invalido');

  const normalizedCpf = normalizeCpf(cpf);
  if (!normalizedCpf) return badRequest(res, 'CPF invalido');

  try {
    const userId = await createUser({
      name,
      email: email.trim().toLowerCase(),
      phone_number: normalizedPhone,
      cpf: normalizedCpf,
      password,
    } satisfies CreateUserDTO);

    await cloneTemplateCategoriesToUser(userId);

    // Dispara OTP de verificacao
    const otp = await sendOtp(normalizedPhone, 'signup', { userId });

    res.status(201).json({
      success: true,
      data: {
        userId,
        phone: normalizedPhone,
        nextStep: 'verify_phone',
        otpCooldownMs: otp.ok ? 0 : otp.cooldownMs,
      },
    });
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.includes('Phone already')) return badRequest(res, 'Telefone ja cadastrado');
    if (msg.includes('Email already')) return badRequest(res, 'Email ja cadastrado');
    if (msg.includes('CPF already')) return badRequest(res, 'CPF ja cadastrado');
    if (msg.includes('Username already')) return badRequest(res, 'Email ja cadastrado');

    console.error('Signup error:', err);
    res.status(500).json({ success: false, error: 'Erro ao criar conta' });
  }
}

// ------------------------------------------------------------
// Verifica OTP de signup
// ------------------------------------------------------------

export async function verifyPhone(req: Request, res: Response): Promise<void> {
  const { phone, code } = req.body || {};
  if (!phone || !code) return badRequest(res, 'Telefone e codigo sao obrigatorios');

  const normalized = normalizePhoneBR(phone);
  if (!normalized) return badRequest(res, 'Telefone invalido');

  const ok = await verifyOtp(normalized, code, 'signup');
  if (!ok) return badRequest(res, 'Codigo invalido ou expirado');

  const user = await getUserByPhone(normalized);
  if (!user) return badRequest(res, 'Usuario nao encontrado');

  await setPhoneVerified(user.id, true);

  // Apos verificar telefone, ja emite token (mas usuario ainda precisa
  // cadastrar plano + cartao para usar o app — frontend leva para
  // a etapa de pagamento).
  const token = signToken({ userId: user.id, role: 'user' });
  res.json({
    success: true,
    data: {
      token,
      nextStep: 'choose_plan',
    },
  });
}

// ------------------------------------------------------------
// Reenvio de OTP
// ------------------------------------------------------------

export async function resendOtp(req: Request, res: Response): Promise<void> {
  const { phone, purpose } = req.body || {};
  if (!phone || !purpose) return badRequest(res, 'Telefone e proposito sao obrigatorios');

  const validPurposes = ['signup', 'reset_password', 'change_phone'];
  if (!validPurposes.includes(purpose)) return badRequest(res, 'Proposito invalido');

  const normalized = normalizePhoneBR(phone);
  if (!normalized) return badRequest(res, 'Telefone invalido');

  const result = await sendOtp(normalized, purpose);
  if (!result.ok) {
    return res.status(429).json({
      success: false,
      error: 'Aguarde antes de pedir um novo codigo',
      cooldownMs: result.cooldownMs,
    }) as any;
  }
  res.json({ success: true });
}

// ------------------------------------------------------------
// Forgot / reset password (via OTP no WhatsApp)
// ------------------------------------------------------------

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { phone } = req.body || {};
  if (!phone) return badRequest(res, 'Telefone e obrigatorio');

  const normalized = normalizePhoneBR(phone);
  if (!normalized) return badRequest(res, 'Telefone invalido');

  const user = await getUserByPhone(normalized);
  // Resposta uniforme — nao expor se telefone existe ou nao
  if (user) {
    await sendOtp(normalized, 'reset_password', { userId: user.id });
  }
  res.json({ success: true });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { phone, code, newPassword } = req.body || {};
  if (!phone || !code || !newPassword) {
    return badRequest(res, 'Telefone, codigo e nova senha sao obrigatorios');
  }
  if (!isStrongPassword(newPassword)) {
    return badRequest(res, 'Senha deve ter ao menos 8 caracteres com letras e numeros');
  }

  const normalized = normalizePhoneBR(phone);
  if (!normalized) return badRequest(res, 'Telefone invalido');

  const ok = await verifyOtp(normalized, code, 'reset_password');
  if (!ok) return badRequest(res, 'Codigo invalido ou expirado');

  const user = await getUserByPhone(normalized);
  if (!user) return badRequest(res, 'Usuario nao encontrado');

  await updatePassword(user.id, newPassword);
  res.json({ success: true });
}

// ------------------------------------------------------------
// Trocar telefone (autenticado)
// ------------------------------------------------------------

export async function requestChangePhone(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const { newPhone, password } = req.body || {};

  if (!newPhone || !password) return badRequest(res, 'Novo telefone e senha sao obrigatorios');

  const normalized = normalizePhoneBR(newPhone);
  if (!normalized) return badRequest(res, 'Telefone invalido');

  const existing = await getUserByPhone(normalized);
  if (existing) return badRequest(res, 'Telefone ja em uso');

  const ok = await verifyUserPasswordById(userId, password);
  if (!ok) return unauthorized(res, 'Senha incorreta');

  await sendOtp(normalized, 'change_phone', { userId });
  res.json({ success: true });
}

export async function confirmChangePhone(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const { newPhone, code } = req.body || {};

  if (!newPhone || !code) return badRequest(res, 'Telefone e codigo sao obrigatorios');

  const normalized = normalizePhoneBR(newPhone);
  if (!normalized) return badRequest(res, 'Telefone invalido');

  const ok = await verifyOtp(normalized, code, 'change_phone');
  if (!ok) return badRequest(res, 'Codigo invalido ou expirado');

  await updatePhone(userId, normalized);
  res.json({ success: true });
}

// ------------------------------------------------------------
// Perfil
// ------------------------------------------------------------

export async function me(req: Request, res: Response): Promise<void> {
  const user = await getUserById(req.userId!);
  if (!user) return unauthorized(res);
  res.json({ success: true, data: user });
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const { name, email, currentPassword, newPassword } = req.body || {};

  if (newPassword) {
    if (!currentPassword) return badRequest(res, 'Senha atual e obrigatoria para trocar a senha');
    if (!isStrongPassword(newPassword)) {
      return badRequest(res, 'Nova senha deve ter ao menos 8 caracteres com letras e numeros');
    }

    const ok = await verifyUserPasswordById(userId, currentPassword);
    if (!ok) return badRequest(res, 'Senha atual incorreta');

    await updatePassword(userId, newPassword);
  }

  if (email !== undefined && email && !isValidEmail(email)) {
    return badRequest(res, 'Email invalido');
  }

  await updateProfile(userId, {
    name: name !== undefined ? name : undefined,
    email: email !== undefined ? email.trim().toLowerCase() : undefined,
  });

  const user = await getUserById(userId);
  res.json({ success: true, data: user });
}
