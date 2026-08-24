# Elsy

**Assistente financeira que vive dentro do WhatsApp.**
O usuário manda "almoço 32 reais", um áudio ou a foto do comprovante — a transação é interpretada,
categorizada e lançada. Sem app para instalar, sem planilha, sem formulário.

Por trás disso é um SaaS multi-tenant completo: cadastro público, verificação por OTP, assinatura
recorrente com cobrança automática e painel administrativo próprio.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=flat-square&logo=mysql&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white)
![WhatsApp](https://img.shields.io/badge/WhatsApp-25D366?style=flat-square&logo=whatsapp&logoColor=white)

---

## O que ele faz

**Três formas de lançar um gasto, todas pela conversa**
Texto vira transação estruturada via modelo de linguagem. Áudio passa por transcrição automática.
Foto de comprovante passa por visão computacional. Os três caminhos desembocam no mesmo lançamento,
e toda transação passa por uma confirmação — responder **1** confirma, **2** cancela.

**Finanças completas, não só um registrador de gastos**
Transações e categorias, contas a pagar com lembrete, caixinhas de reserva, controle de ativos e
investimentos, orçamento mensal por categoria, relatórios e dashboard.

**Assinatura que se administra sozinha**
Trial com aviso três dias e um dia antes do fim. Vencido: novo aviso no terceiro dia, bloqueio no
sétimo e cancelamento no trigésimo. Pagamento confirmado libera o acesso e dispara o recibo.
Ninguém precisa acompanhar isso manualmente.

**Painel administrativo do SaaS**
Métricas, lista e detalhe de usuários, CRUD de planos, pagamentos, histórico de mensagens e
configuração de integrações — tudo pela interface, sem editar arquivo no servidor.

---

## Decisões técnicas que valem nota

**Estado de conversa mora no banco, não na memória.**
A confirmação pendente de uma transação fica na tabela `pending_actions`. O processo pode reiniciar
no meio da conversa que o usuário responde "1" e a transação entra do mesmo jeito — em memória,
todo deploy perderia o contexto de quem estava respondendo.

**O WhatsApp está atrás de uma interface.**
Existe um contrato `MessagingClient` e a implementação atual usa Baileys. Migrar para a API oficial
do WhatsApp Business é escrever outra implementação da mesma interface, sem tocar no dispatcher nem
nas regras de negócio.

**Isolamento entre clientes imposto pelo banco.**
Toda tabela de domínio tem `user_id NOT NULL` com chave estrangeira e índice, e todo model recebe o
`userId` como primeiro parâmetro. Categorias usam `user_id NULL` como template, clonado para o
usuário no cadastro — cada cliente edita as suas sem afetar ninguém.

**Webhook de pagamento é idempotente.**
A tabela `processed_webhooks` tem `event_id` único: o gateway pode reenviar o mesmo evento à vontade
que o efeito acontece uma vez só. Além disso o webhook valida o token do cabeçalho antes de
processar qualquer coisa.

**Credencial de integração não fica em arquivo.**
Chaves do gateway de pagamento, SMTP e OpenAI ficam em `system_config`, encriptadas com AES-256-GCM,
e são administradas pela tela de configurações.

**Migração de senha sem forçar reset.**
Senhas antigas em SHA-256 são reconvertidas para bcrypt no próximo login bem-sucedido — a base
legada migra sozinha, sem obrigar ninguém a trocar de senha.

**Portaria antes do modelo.**
Antes de qualquer chamada de IA, um *gate* resolve o telefone, barra não cadastrado, não verificado
e plano inativo, com cooldown por número. Quem não é cliente nunca chega a consumir token.

**Defesa em camadas no acesso.**
Limite de 20 requisições por minuto por IP nas rotas públicas, 5 no login administrativo, 100 por
usuário nas autenticadas e 1 mensagem por segundo por usuário no bot.

---

## Como está construído

Um único processo Node.js concentra quatro papéis: a API REST, o bot do WhatsApp, os agendadores
em memória (lembretes de contas e ciclo de assinatura) e o serviço da SPA já compilada.
Um processo, uma porta, um deploy.

```
Mensagem no WhatsApp
   └── gate: identifica o telefone, valida cadastro e plano
        └── roteia por tipo: comando · conta · caixinha · resposta pendente · transação
             ├── texto  → modelo de linguagem → JSON da transação
             ├── áudio  → transcrição → mesmo fluxo
             └── imagem → visão computacional → mesmo fluxo
                  └── confirmação (1 / 2) gravada em pending_actions
                       └── transação persistida sob o user_id do cliente
```

---

## Rodando localmente

Requer Node.js e MySQL.

```bash
npm run setup     # dependências, build do frontend e migrations
npm run dev       # backend em modo desenvolvimento

cd frontend && npm run dev   # opcional: Vite com proxy /api → :3000
```

Testes com `npm test` (Vitest + Supertest). Build de produção com `npm run build` e `npm start`.

---

<details>
<summary><b>Referência — ambiente, autenticação, API e banco</b></summary>

### Variáveis de ambiente

| Variável | Para que serve |
|---|---|
| `DB_*` | Conexão com o MySQL |
| `JWT_SECRET` | Assinatura do token de sessão |
| `ENCRYPTION_KEY` | 32 bytes em hex — cifra das credenciais em `system_config` |
| `APP_URL` | URL pública usada nos links enviados nas mensagens |
| `OPENAI_API_KEY` | Provedor de IA |
| `ADMIN_BOOTSTRAP_PASSWORD` | Só em ambiente novo, quando ainda não existe admin |

Gateway de pagamento, SMTP e chave da OpenAI também podem ser configurados pela tela de
administração, e nesse caso ficam encriptados no banco.

### Autenticação

- Usuário: telefone (E.164 sem `+`) e senha
- Administrador: usuário e senha, em rota separada
- Cadastro público com nome, e-mail, telefone, senha e CPF validado
- OTP pelo próprio WhatsApp para confirmar telefone, redefinir senha e trocar de número
- Token JWT de 7 dias com `{ userId, role }`; bcrypt com 10 rounds

### API

Prefixo `/api`.

| Área | Rotas |
|---|---|
| Autenticação | `auth` — login, login admin, cadastro, OTP, recuperação |
| Finanças | `transactions` · `categories` · `bills` · `savingsBoxes` · `budgets` |
| Patrimônio | `assets` · `assetMovements` |
| Análise | `dashboard` · `reports` |
| SaaS | `subscription` · `admin` · `system` · `business` |
| Público e integrações | `public` · `webhooks` |

### Banco

MySQL em utf8mb4. O `schema.sql` é aplicado uma única vez e registrado em `schema_migrations`;
depois disso valem apenas as migrations incrementais, executadas em ordem alfabética.

</details>
