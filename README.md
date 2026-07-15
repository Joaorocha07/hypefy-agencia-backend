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
   - **Digital (streaming/ferramenta):** reserva um item do estoque, marca como vendido e posta as credenciais no chat do pedido (`is_delivery = true`), seguido de uma mensagem `SYSTEM` de contexto ("Seu acesso está nos dados acima...").
   - **Engajamento:** cria o pedido na API Baratos Sociais e acompanha o status via job periódico (`src/jobs/syncEngagementOrders.js`, a cada 10 min).

`Product.stockQuantity` é **derivado, nunca gravável pelo cliente** — reflete sempre `COUNT(StockItem WHERE productId = X AND isSold = false)`. `POST/PUT /products` ignora silenciosamente qualquer `stockQuantity` no corpo da requisição; a única forma real de alterar o estoque é adicionar/vender itens em `StockItem` (`stock.service.js#addStockItems`, `order.service.js#fulfillDigitalOrder`), que resincronizam o contador via `stock.service.js#syncProductStockQuantity` dentro da mesma transação (recomputa do zero, em vez de incrementar/decrementar — autocorrige qualquer desvio anterior). A verificação de estoque em `createOrder` também conta `StockItem` ao vivo, nunca confia no campo cacheado. Isso corrige um bug em que editar um produto pelo formulário podia sobrescrever `stockQuantity` com um número arbitrário, dessincronizando do estoque real.

Contas compartilhadas no estoque: uma conta vendida para N pessoas vira N `StockItem` com o mesmo `content` (uma vaga por venda). `GET /stock/products/{productId}` continua retornando uma linha por vaga (raw, sem `content`, usado por ex. pelo histórico de movimentação). `GET /stock/products/{productId}/accounts` agrupa por `content` e retorna uma linha por conta (`available`/`sold` somando as vagas daquele grupo, `content`, `lastEditedAt`/`lastEditedByName` incluídos) — é essa que a tela de gerenciamento usa para não repetir a mesma conta várias vezes; `id` no retorno é uma vaga representante do grupo.

`PUT /api/v1/stock/items/{itemId}` edita a credencial e atualiza **todas** as vagas (vendidas e disponíveis) que tinham o content antigo, já que representam a mesma conta; grava `lastEditedById`/`updatedAt` (só a edição mais recente é guardada, não um histórico completo). `StockItem.orderId` liga cada vaga vendida ao pedido que a consumiu (preenchido em `fulfillDigitalOrder`) — sem isso não dava pra saber qual pedido corresponde a qual vaga quando o mesmo cliente compra o mesmo produto mais de uma vez. `GET /api/v1/stock/items/{itemId}/customers` usa esse vínculo para listar quem tem uma vaga vendida nesta conta, com dados do pedido e contato do cliente (nome, email, telefone, avatar).

`GET /api/v1/stock/products/{productId}/notify-preview` lista quem seria notificado (nome/email/pedido) sem enviar nada — mesmo critério de elegibilidade do envio real, para o operador conferir antes de confirmar. `POST /api/v1/stock/products/{productId}/notify-access-update` (body `{ content, orderIds? }`) reenvia o acesso atualizado — como mensagem de entrega no chat (`isDelivery=true`) e atualizando `Order.deliveredContent` — para todo pedido pago desse produto criado nos últimos `Product.accessDurationDays` dias (todos os pedidos pagos, se o produto não tiver esse prazo configurado), ou apenas para o subconjunto de `orderIds` informado (envio seletivo). Cada envio é registrado em `AccessUpdateLog` (`GET /stock/products/{productId}/access-log` traz os últimos 10) — o status é sempre `"Enviado"`, já que as mensagens são gravadas de forma síncrona no chat interno; não há canal externo (email/WhatsApp) integrado cuja entrega possa "falhar" ou ficar pendente. `accessDurationDays` é um campo opcional do produto (ex: 30 para "1 mês"), editável em `POST/PUT /products`.

Chat não lido (cliente): `Order.customerLastReadAt` guarda quando o cliente visualizou por último o chat de cada pedido. É atualizado automaticamente ao abrir o chat (`GET /api/v1/chat/{orderId}`, como `USER`) ou explicitamente via `POST /api/v1/chat/{orderId}/read` (um pedido) / `POST /api/v1/chat/read-all` (todos). `GET /api/v1/chat/unread-count` soma as mensagens de vendedor/sistema criadas depois desse timestamp em todos os pedidos do cliente (usado pelo sininho do header). `GET /api/v1/chat/notifications` traz até 20 itens — a mensagem mais recente de cada pedido, lida ou não, com um `type` (`delivery` | `payment_confirmed` | `system` | `chat_message`) usado para escolher ícone/cor no dropdown de notificações.

Chat não lido (equipe): espelha o mecanismo do cliente com `Order.staffLastReadAt`, mas é **global e compartilhado** — como ADM/FUNC podem acessar qualquer pedido (não só "os seus"), não há um dono para escopar a notificação, e abrir o chat de um pedido (como `ADM`/`FUNC`) ou marcar como lido (`POST /api/v1/chat/{orderId}/read`) marca aquele pedido como lido para toda a equipe. `GET /api/v1/chat/admin/unread-count`, `GET /api/v1/chat/admin/notifications` (mensagens do cliente, até 20 pedidos mais recentes) e `POST /api/v1/chat/admin/read-all` espelham os endpoints do cliente, protegidos por `authorize('ADM', 'FUNC')`.

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
