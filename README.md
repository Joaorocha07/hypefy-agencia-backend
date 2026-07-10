# Hypefy Agência — Backend

Backend REST (Node.js + Express + Prisma + PostgreSQL/Neon) da plataforma Hypefy Agência: venda de serviços de engajamento social (via API Baratos Sociais), contas de streaming/ferramentas, pagamentos via Mercado Pago (PIX) e painel administrativo completo.

## Stack

- **Runtime:** Node.js + Express
- **Banco de dados:** PostgreSQL (Neon — serverless)
- **ORM:** Prisma
- **Autenticação:** JWT (access + refresh) + bcrypt
- **Pagamentos:** Mercado Pago (PIX/QR Code)
- **SMM Panel:** Baratos Sociais (`https://baratosociais.com/api/v2`)
- **Armazenamento de imagens:** Cloudflare R2 (S3-compatible)
- **Validação:** Zod
- **Documentação:** Swagger/OpenAPI (`/docs`) + coleção Postman

## Estrutura de pastas

```
src/
├── config/        # Prisma client, Mercado Pago, R2, mailer
├── controllers/    # Lógica dos endpoints
├── middlewares/    # Auth, error handler, validação, upload, rate limit
├── routes/         # Definição das rotas
├── services/       # Regras de negócio e integrações externas
├── utils/          # Helpers (JWT, senha, respostas padronizadas, erros)
├── jobs/           # Cron jobs (sync de pedidos de engajamento)
├── validators/     # Schemas Zod por módulo
├── docs/           # Configuração do Swagger
├── app.js          # Configuração do Express
└── server.js       # Entry point
prisma/
├── schema.prisma   # Schema do banco (7 tabelas)
└── seed.js         # Cria o usuário ADM inicial
postman/
└── hypefy-agencia-backend.postman_collection.json
docs/
└── baratos-sociais-api.md  # Documentação de uso da API Baratos Sociais
```

## Instalação

```bash
npm install
cp .env.example .env
# preencha .env com suas credenciais (Neon, Mercado Pago, R2, SMTP)
```

## Banco de dados

```bash
npm run prisma:generate     # gera o Prisma Client
npm run prisma:migrate      # cria as tabelas no banco (dev)
npm run prisma:deploy       # aplica migrations em produção
npm run seed                # cria o usuário ADM inicial (email/senha em SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
```

## Rodando localmente

```bash
npm run dev     # nodemon, recarrega a cada alteração
npm start       # produção
```

A API sobe em `http://localhost:3000` (ou a porta definida em `PORT`):

- Health check: `GET /health`
- Documentação Swagger: `GET /docs`
- Base das rotas da API: `/api/v1`

## Variáveis de ambiente

Veja `.env.example` para a lista completa. Principais grupos:

- `DATABASE_URL` — string de conexão do Neon (Postgres)
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — segredos dos tokens
- `MP_ACCESS_TOKEN` / `MP_WEBHOOK_SECRET` / `MP_WEBHOOK_URL` — Mercado Pago
- `BARATOS_SOCIAIS_API_KEY` / `BARATOS_SOCIAIS_BASE_URL` — SMM Panel
- `R2_*` — Cloudflare R2 (upload de imagens dos produtos)
- `SMTP_*` / `FRONTEND_URL` — envio de email de redefinição de senha

## Perfis de acesso

| Perfil | Pode |
|---|---|
| **ADM** | Tudo: produtos, estoque, preços, margens de engajamento, cupons, funcionários, dashboard financeiro |
| **FUNC** | Produtos (exceto preço/margem/custo), estoque, clientes, chat/entregas, pedidos — **sem** acesso a valores de produtos, faturamento ou gestão de cupons/funcionários |
| **USER** | Catálogo público, compra, meus pedidos, chat do pedido, perfil |

## Fluxo de compra (resumo)

1. Cliente autenticado cria um pedido (`POST /api/v1/orders`) — para engajamento informa `targetUsername`/`targetUrl`; cupom opcional.
2. O backend calcula o preço (produto digital = preço fixo; engajamento = `rate da API × (quantidade/1000) × (1 + margem%)`), aplica desconto de cupom e gera um pagamento PIX no Mercado Pago (QR Code retornado na resposta).
3. O Mercado Pago notifica `POST /api/v1/webhooks/mercado-pago` quando o pagamento é aprovado.
4. O backend marca o pedido como `PAID`, registra as transações (`SALE`/`COST`) e entrega automaticamente:
   - **Digital (streaming/ferramenta):** reserva um item do estoque, marca como vendido e posta as credenciais no chat do pedido (`is_delivery = true`).
   - **Engajamento:** cria o pedido na API Baratos Sociais e acompanha o status via job periódico (`src/jobs/syncEngagementOrders.js`, a cada 10 min).

## Documentação adicional

- **Baratos Sociais API:** `docs/baratos-sociais-api.md` — todos os endpoints (`services`, `add`, `status`, `refill`, `refill_status`, `cancel`, `balance`) com exemplos de request/response e client Node.js de referência.
- **Postman:** importe `postman/hypefy-agencia-backend.postman_collection.json` no Postman/Insomnia. Faça login em `Auth > Login` e copie o `accessToken` da resposta para a variável de coleção `accessToken`.
- **Swagger:** `http://localhost:3000/docs` (spec gerada a partir de `src/docs/swagger.js`).

## Segurança

- Senhas com bcrypt (12 rounds).
- JWT de acesso (15 min) + refresh (7 dias), segredos separados.
- Rate limiting nas rotas de autenticação e pagamento.
- Helmet + CORS habilitados.
- Assinatura do webhook do Mercado Pago validada via HMAC (`x-signature`) quando `MP_WEBHOOK_SECRET` está configurado.
- Campos financeiros (`costPrice`, `profitMarginPercent`) nunca são expostos no catálogo público nem para o perfil `FUNC`.
# hypefy-agencia-backend
