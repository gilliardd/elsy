# CLAUDE.md

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.




This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Elsy — assistente financeira no WhatsApp, multi-tenant (SaaS). A single Node.js
process runs (a) an Express REST API, (b) a WhatsApp bot via Baileys, (c)
in-process schedulers (bill reminders + subscription lifecycle), and serves
the built React/Vite SPA from `frontend/dist`.

Strings de UI, comentarios e commits em pt-BR. Match esse estilo ao editar.

## Commands

| Task | Command |
|---|---|
| Setup completo (deps + FE build + migrations) | `npm run setup` |
| Backend dev | `npm run dev` |
| Build backend | `npm run build` |
| Tests (vitest) | `npm test` |
| Apply migrations | `npm run db:migrate` |
| Bootstrap categorias do admin | `npm run db:bootstrap-admin` |
| Frontend dev (Vite, proxies /api → :3000) | `cd frontend && npm run dev` |
| Frontend build | `npm run frontend:build` |

## Architecture

### Single-process layout

[src/app.ts](src/app.ts):
1. valida env, conecta MySQL, garante admin (via `ADMIN_BOOTSTRAP_PASSWORD`
   apenas se o banco estiver vazio)
2. monta `/api` ([src/routes/index.ts](src/routes/index.ts)) e SPA
3. inicia WhatsApp via [src/whatsapp/index.ts](src/whatsapp/index.ts)
4. inicia [src/services/subscriptionScheduler.ts](src/services/subscriptionScheduler.ts)
   (trial reminders, overdue, cortesia)

### Multi-tenancy

Todo dado de dominio (transactions, bills, savings_boxes, investments,
asset_movements, budgets, monthly_budgets, monthly_budget_items) tem
`user_id NOT NULL` com FK e index. Categorias usam `user_id NULL = template`
clonado no signup ([src/models/Category.ts](src/models/Category.ts)
`cloneTemplateCategoriesToUser`).

Models recebem `userId` como primeiro parametro e filtram por `WHERE user_id = ?`.
Controllers extraem de `req.userId` (injetado pelo middleware JWT).

### Auth

- Admin: `username + password` via `POST /api/auth/admin/login`
- Usuario: `phone + password` via `POST /api/auth/login` (telefone E.164 sem +)
- Signup publico: `POST /api/auth/signup` (nome, email, telefone, senha, CPF
  validado)
- OTP via WhatsApp (mesmo numero do bot) para confirmar telefone, reset de
  senha e troca de telefone
- JWT 7d com payload `{ userId, role }`
- bcrypt rounds=10; senhas SHA-256 legadas migram automaticamente no proximo
  login
- Rate limit: 20/min/IP publicas, 5/min admin login, 100/min/usuario nas
  autenticadas

### WhatsApp / messaging adapter

[src/messaging/types.ts](src/messaging/types.ts) define `MessagingClient`.
Implementacao atual: [src/messaging/whatsapp/baileysClient.ts](src/messaging/whatsapp/baileysClient.ts)
(Baileys com sessao persistente em `whatsapp-session/`). Para trocar pelo
WhatsApp Business API oficial, basta nova implementacao da interface.

[src/whatsapp/index.ts](src/whatsapp/index.ts) e o dispatcher:
1. `gate.ts` identifica usuario por telefone, bloqueia nao-cadastrados,
   nao-verificados, ou planos inativos (cooldown 1h por numero)
2. Texto vira: pendente (resposta "1"/"2"), comando, caixinha, conta a pagar,
   ou transacao (parser IA)
3. Voz → Whisper → transacao
4. Imagem → GPT-4o vision → transacao
5. Confirmacao de transacao via texto "1" (confirmar) / "2" (cancelar);
   estado em `pending_actions` (DB, nao memoria)
6. Rate limit 1 msg/seg por usuario

### Asaas (cobranca)

Customer + subscription criados em [src/services/asaasService.ts](src/services/asaasService.ts);
config (api_key, environment, webhook_token) em `system_config` encriptado
(AES-256-GCM via `ENCRYPTION_KEY`).

Webhook em `POST /api/webhooks/asaas` valida `asaas-access-token` header
e usa `processed_webhooks` (event_id UNIQUE) para idempotencia.
Eventos tratados: PAYMENT_CONFIRMED/RECEIVED/OVERDUE/REFUNDED/UPDATED,
SUBSCRIPTION_DELETED.

[src/services/subscriptionScheduler.ts](src/services/subscriptionScheduler.ts)
roda 9h-19h hourly:
- trial: aviso D-3 e D-1
- overdue: D+3 (2o aviso, cooldown 1d), D+7 (bloqueia), D+30 (cancela)
- cortesia: ao expirar, status -> blocked

### Notificacoes

WhatsApp via adapter; email via SMTP configurado em `system_config`
([src/services/emailService.ts](src/services/emailService.ts) +
[src/services/notifications.ts](src/services/notifications.ts)).
Hooks: signup → welcome email; create subscription → trial started;
webhook → recibo / overdue / cancelado; forgotPassword → OTP no WhatsApp +
email com mesmo codigo.

### AI provider

OpenAI:
- `gpt-4o-mini` — texto → JSON transacao
- `whisper-1` — transcricao de audio (pt)
- `gpt-4o` — vision em comprovantes

System prompt em [src/services/aiService.ts](src/services/aiService.ts)
identifica "Elsy, assistente financeira brasileira". Lista de categorias
e injetada do DB — adicionar categoria no DB e suficiente.

### Database

MySQL (utf8mb4). [src/database/migrate.ts](src/database/migrate.ts)
aplica `schema.sql` apenas uma vez (registrado como `__schema__` em
`schema_migrations`) + migrations incrementais em
[database/migrations/](database/migrations/) em ordem alfabetica.

Migrations da virada SaaS:
- `001_multitenancy.sql` — adiciona user_id, dropa cash_accounts/alerts
- `002_dedupe_template_categories.sql` — limpeza pos-001
- `003_saas_auth.sql` — colunas em users (phone, cpf, status, etc.) +
  tabelas plans, subscriptions, payments, otp_codes, pending_actions,
  system_config, user_preferences, processed_webhooks, message_logs
- `004_overdue_tracking.sql` — overdue_since em subscriptions

### Frontend

React 18 + Vite + Tailwind (sem UI kit). Duas areas:
- App de financas pessoais (admin tambem usa pra dogfood seu user_id):
  rotas em `/`, `/transacoes`, `/caixinhas`, `/contas`, etc. com
  `<ProtectedRoute>`
- Painel SaaS Admin: `/admin/*` com `<AdminProtectedRoute>` (exige
  role='admin'). Inclui dashboard de metricas, lista/detalhe de usuarios,
  CRUD de planos, pagamentos, mensagens, configuracoes (Asaas/SMTP/OpenAI/
  WhatsApp QR).

API admin centralizada em [frontend/src/services/adminApi.ts](frontend/src/services/adminApi.ts).
API user em [frontend/src/services/api.ts](frontend/src/services/api.ts).
Token armazenado em `localStorage['elsy_auth']`.

## Environment

Variaveis necessarias em `.env`:
- `JWT_SECRET` — string forte, usada de verdade agora
- `ENCRYPTION_KEY` — 32 bytes em hex (64 chars). Gerar com:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `APP_URL` — URL publica usada em links das mensagens
- `OPENAI_API_KEY`
- `DB_*`
- `ADMIN_BOOTSTRAP_PASSWORD` — apenas em ambientes novos sem admin no DB
  (em ambientes existentes, `ensureAdminExists` e no-op)

Asaas, SMTP, e opcionalmente `OPENAI_API_KEY` sao gerenciadas via
`/admin/configuracoes` (gravadas encriptadas em `system_config`).

## Branch SaaS migration

A virada de bot pessoal -> SaaS multi-tenant foi feita em 6 fases sequenciais:

1. multi-tenancy do banco
2. auth nova (JWT, bcrypt, signup com telefone+CPF, OTP stub)
3. WhatsApp via Baileys (substituiu Telegram)
4. Asaas + scheduler de cobranca
5. painel admin frontend
6. notificacoes email + hooks
7. rename FinBot -> Elsy + persona
