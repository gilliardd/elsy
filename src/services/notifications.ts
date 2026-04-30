// Notificacoes transacionais. Cada funcao envia tanto via email (se
// SMTP configurado) quanto registra a cadencia esperada de WhatsApp
// pelo scheduler / handlers existentes. Aqui mantemos os templates.

import { sendEmail } from './emailService';
import { env } from '../config/env';

function shell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR"><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f5f5f5; margin:0; padding:24px;">
<table align="center" width="600" cellpadding="0" cellspacing="0" style="background:#fff; border-radius:8px; padding:32px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
<tr><td>
<h1 style="margin:0 0 16px; font-size:20px; color:#111;">Elsy</h1>
<h2 style="margin:0 0 16px; font-size:16px; color:#333;">${title}</h2>
<div style="font-size:14px; color:#444; line-height:1.6;">${body}</div>
<hr style="border:none; border-top:1px solid #eee; margin:32px 0;" />
<p style="font-size:12px; color:#999; margin:0;">Elsy — sua assistente financeira no WhatsApp.<br/>${env.appUrl}</p>
</td></tr></table></body></html>`;
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Bem-vindo a Elsy',
    html: shell(
      `Oi, ${name}! 👋`,
      `<p>Sua conta foi criada.</p>
       <p>Em alguns instantes voce vai receber um codigo no WhatsApp para confirmar seu numero. Apos confirmar, contrate um plano e comece a usar.</p>
       <p>Acesse: <a href="${env.appUrl}">${env.appUrl}</a></p>`
    ),
  });
}

export async function sendTrialStartedEmail(
  to: string,
  name: string,
  trialEndsAt: Date
): Promise<void> {
  const fmt = trialEndsAt.toLocaleDateString('pt-BR');
  await sendEmail({
    to,
    subject: 'Seu trial da Elsy comecou',
    html: shell(
      `Tudo certo, ${name}!`,
      `<p>Seu trial gratuito esta ativo ate <strong>${fmt}</strong>.</p>
       <p>Mande mensagens no WhatsApp para a Elsy a partir de agora — texto, audio ou foto de comprovante. Ela registra suas transacoes automaticamente.</p>
       <p>Gerencie sua assinatura em <a href="${env.appUrl}/app/billing">${env.appUrl}/app/billing</a>.</p>`
    ),
  });
}

export async function sendPaymentReceiptEmail(
  to: string,
  name: string,
  amountCents: number,
  paidAt: Date
): Promise<void> {
  const value = (amountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const date = paidAt.toLocaleDateString('pt-BR');
  await sendEmail({
    to,
    subject: 'Recibo de pagamento — Elsy',
    html: shell(
      `Pagamento recebido`,
      `<p>Oi, ${name}.</p>
       <p>Recebemos seu pagamento de <strong>${value}</strong> em ${date}.</p>
       <p>Sua assinatura segue ativa. Obrigado por usar a Elsy!</p>`
    ),
  });
}

export async function sendOverdueEmail(to: string, name: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Atualize seu cartao — Elsy',
    html: shell(
      `Nao conseguimos processar seu pagamento`,
      `<p>Oi, ${name}.</p>
       <p>Tentamos cobrar seu cartao mas nao deu certo. Pode ser limite, cartao expirado ou algum bloqueio do banco.</p>
       <p>Atualize em <a href="${env.appUrl}/app/billing">${env.appUrl}/app/billing</a> para nao perder o acesso.</p>`
    ),
  });
}

export async function sendBlockedEmail(to: string, name: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Sua assinatura foi bloqueada — Elsy',
    html: shell(
      `Acesso bloqueado`,
      `<p>Oi, ${name}.</p>
       <p>Apos varias tentativas de cobranca sem sucesso, sua assinatura foi bloqueada.</p>
       <p>Para reativar, atualize seu cartao em <a href="${env.appUrl}/app/billing">${env.appUrl}/app/billing</a>.</p>`
    ),
  });
}

export async function sendCancelledEmail(to: string, name: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Sua assinatura foi cancelada — Elsy',
    html: shell(
      `Assinatura cancelada`,
      `<p>Oi, ${name}.</p>
       <p>Sua assinatura foi cancelada. Seus dados continuam preservados — quando quiser voltar, basta reativar.</p>
       <p>Acesse <a href="${env.appUrl}/cadastro">${env.appUrl}/cadastro</a>.</p>`
    ),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  code: string
): Promise<void> {
  await sendEmail({
    to,
    subject: 'Codigo de redefinicao de senha — Elsy',
    html: shell(
      `Redefinicao de senha`,
      `<p>Oi, ${name}.</p>
       <p>Recebemos um pedido para redefinir sua senha. Use o codigo abaixo:</p>
       <p style="font-size:28px; font-weight:bold; letter-spacing:4px; padding:16px; background:#f5f5f5; border-radius:6px; text-align:center;">${code}</p>
       <p>O codigo expira em 5 minutos. Se nao foi voce, ignore este email.</p>`
    ),
  });
}
