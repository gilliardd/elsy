import { Request, Response } from 'express';
import {
  getUserById,
  setSubscriptionStatus,
  setAsaasCustomerId,
  markTrialUsed,
} from '../models/User';
import { getPlanById, getAllPlans, getPlansForAccountType } from '../models/Plan';
import {
  createSubscription as dbCreateSubscription,
  getActiveSubscriptionByUser,
  getSubscriptionsByUser,
  setCancelAtPeriodEnd,
  softDeleteSubscription,
} from '../models/Subscription';
import { getPaymentsBySubscription } from '../models/Payment';
import {
  createCustomer,
  createSubscription as asaasCreateSubscription,
  cancelSubscription as asaasCancelSubscription,
  getAsaasConfig,
} from '../services/asaasService';
import { sendTrialStartedEmail } from '../services/notifications';

function badRequest(res: Response, error: string) {
  res.status(400).json({ success: false, error });
}

// ------------------------------------------------------------
// GET /api/public/plans?accountType=personal|business  (publico)
// ------------------------------------------------------------
export async function listPublicPlans(req: Request, res: Response): Promise<void> {
  const accountType = req.query.accountType as string | undefined;
  const plans =
    accountType === 'personal' || accountType === 'business'
      ? await getPlansForAccountType(accountType)
      : await getAllPlans(false);

  res.json({
    success: true,
    data: plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price_cents: p.price_cents,
      trial_days: p.trial_days,
      account_type: p.account_type,
      sort_order: p.sort_order,
    })),
  });
}

// ------------------------------------------------------------
// POST /api/subscription   (autenticado)
// body: { planId, creditCard, creditCardHolderInfo }
// ------------------------------------------------------------
interface CardInput {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

interface CardHolderInfo {
  postalCode: string;
  addressNumber: string;
}

export async function createUserSubscription(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const { planId, creditCard, creditCardHolderInfo } = req.body || {};

  if (!planId || !creditCard || !creditCardHolderInfo) {
    return badRequest(res, 'planId, creditCard e creditCardHolderInfo sao obrigatorios');
  }

  const cfg = await getAsaasConfig();
  if (!cfg) return badRequest(res, 'Sistema de pagamento nao configurado');

  const user = await getUserById(userId);
  if (!user) return badRequest(res, 'Usuario nao encontrado');
  if (!user.phone_verified) return badRequest(res, 'Telefone nao verificado');
  if (!user.cpf || !user.email || !user.phone_number) {
    return badRequest(res, 'Cadastro incompleto');
  }

  const existing = await getActiveSubscriptionByUser(userId);
  if (existing) return badRequest(res, 'Voce ja possui uma assinatura ativa');

  const plan = await getPlanById(Number(planId));
  if (!plan || !plan.is_active) return badRequest(res, 'Plano invalido');

  const card = creditCard as CardInput;
  const holder = creditCardHolderInfo as CardHolderInfo;

  if (!card.holderName || !card.number || !card.expiryMonth || !card.expiryYear || !card.ccv) {
    return badRequest(res, 'Dados do cartao incompletos');
  }
  if (!holder.postalCode || !holder.addressNumber) {
    return badRequest(res, 'Endereco incompleto');
  }

  // Cria/recupera customer no Asaas
  let asaasCustomerId = user.asaas_customer_id;
  if (!asaasCustomerId) {
    try {
      const customer = await createCustomer({
        name: user.name,
        email: user.email,
        phone: user.phone_number,
        cpf: user.cpf,
      });
      asaasCustomerId = customer.id;
      await setAsaasCustomerId(userId, asaasCustomerId);
    } catch (err: any) {
      console.error('Erro criando customer Asaas:', err);
      return badRequest(res, 'Erro ao registrar cliente no provedor de pagamento');
    }
  }

  // Trial 1x por usuario: se ja foi usado, primeira cobranca e hoje
  const trialDays = user.trial_used ? 0 : plan.trial_days;
  const today = new Date();
  const nextDueDate = new Date(today);
  nextDueDate.setDate(today.getDate() + trialDays);
  const nextDueDateStr = nextDueDate.toISOString().split('T')[0];

  // Cria subscription no Asaas
  let asaasSub;
  try {
    asaasSub = await asaasCreateSubscription({
      customerId: asaasCustomerId,
      valueCents: plan.price_cents,
      nextDueDate: nextDueDateStr,
      description: `Plano ${plan.name} — Elsy`,
      creditCard: {
        holderName: card.holderName,
        number: card.number,
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
        ccv: card.ccv,
      },
      creditCardHolderInfo: {
        name: user.name,
        email: user.email,
        cpfCnpj: user.cpf,
        postalCode: holder.postalCode,
        addressNumber: holder.addressNumber,
        phone: user.phone_number,
      },
    });
  } catch (err: any) {
    console.error('Erro criando subscription Asaas:', err);
    return badRequest(
      res,
      err?.body?.errors?.[0]?.description || 'Erro ao criar assinatura. Verifique os dados do cartao.'
    );
  }

  // Persiste local
  const subStatus = trialDays > 0 ? 'trialing' : 'active';
  const trialEndsAt = trialDays > 0 ? nextDueDate : null;

  const subscriptionId = await dbCreateSubscription({
    user_id: userId,
    plan_id: plan.id,
    asaas_subscription_id: asaasSub.id,
    status: subStatus,
    started_at: new Date(),
    trial_ends_at: trialEndsAt || undefined,
    current_period_end: nextDueDate,
  });

  await markTrialUsed(userId);
  await setSubscriptionStatus(userId, subStatus, nextDueDate, subscriptionId);

  // Email de trial iniciado (best-effort)
  if (trialDays > 0 && user.email) {
    sendTrialStartedEmail(user.email, user.name, nextDueDate).catch((err) =>
      console.error('Erro enviando trial started email:', err)
    );
  }

  res.status(201).json({
    success: true,
    data: { subscriptionId, status: subStatus, trialEndsAt },
  });
}

// ------------------------------------------------------------
// GET /api/subscription/me   (autenticado)
// ------------------------------------------------------------
export async function getMySubscription(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const subscription = await getActiveSubscriptionByUser(userId);
  if (!subscription) {
    res.json({ success: true, data: null });
    return;
  }

  const plan = await getPlanById(subscription.plan_id);
  const payments = await getPaymentsBySubscription(subscription.id);

  res.json({
    success: true,
    data: {
      subscription,
      plan,
      payments,
    },
  });
}

// ------------------------------------------------------------
// POST /api/subscription/cancel   (autenticado)
// Marca para cancelar ao fim do ciclo + cancela no Asaas
// ------------------------------------------------------------
export async function cancelMySubscription(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const subscription = await getActiveSubscriptionByUser(userId);
  if (!subscription) return badRequest(res, 'Sem assinatura ativa');

  await setCancelAtPeriodEnd(subscription.id, true);

  if (subscription.asaas_subscription_id) {
    try {
      await asaasCancelSubscription(subscription.asaas_subscription_id);
    } catch (err) {
      console.error('Erro cancelando no Asaas:', err);
      // Continua — local marcado mesmo se Asaas falhar; admin pode resolver manualmente.
    }
  }

  res.json({
    success: true,
    data: { cancelAtPeriodEnd: true, currentPeriodEnd: subscription.current_period_end },
  });
}

// ------------------------------------------------------------
// POST /api/subscription/reactivate   (autenticado)
// Apenas remove a flag cancel_at_period_end se subscription ainda estiver ativa
// ------------------------------------------------------------
export async function reactivateMySubscription(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const subscription = await getActiveSubscriptionByUser(userId);
  if (!subscription) return badRequest(res, 'Sem assinatura ativa');
  if (!subscription.cancel_at_period_end) return badRequest(res, 'Assinatura nao esta marcada para cancelamento');

  await setCancelAtPeriodEnd(subscription.id, false);
  res.json({ success: true });
}

// Lista historico de assinaturas (incluindo canceladas)
export async function listMySubscriptions(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const subs = await getSubscriptionsByUser(userId);
  res.json({ success: true, data: subs });
}
