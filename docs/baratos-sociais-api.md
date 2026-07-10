# Documentação — Integração com a API Baratos Sociais

Documentação de uso de todos os endpoints da API Baratos Sociais (SMM Panel), usada pelo backend Hypefy Agência para venda de serviços de engajamento (seguidores, curtidas, visualizações, inscritos).

## 1. Visão Geral

- **Base URL:** `https://baratosociais.com/api/v2`
- **Método HTTP:** `POST` (todos os endpoints, incluindo consultas)
- **Formato:** `application/x-www-form-urlencoded` (todos os parâmetros vão no corpo do POST)
- **Resposta:** `JSON`
- **Autenticação:** parâmetro `key` enviado em todo request (sem headers especiais, sem OAuth)

> ⚠️ **Segurança:** nunca exponha a API key no frontend ou em repositórios públicos. Ela deve viver apenas no backend, carregada via variável de ambiente.

### Variável de ambiente

```env
BARATOS_SOCIAIS_API_KEY="dc1af773ecee78bb3b6194f169eec871"
BARATOS_SOCIAIS_BASE_URL="https://baratosociais.com/api/v2"
```

### Cliente HTTP base (Node.js)

Todos os exemplos abaixo assumem um client simples reutilizável:

```js
// src/services/baratosSociais.js
const axios = require('axios');

const BASE_URL = process.env.BARATOS_SOCIAIS_BASE_URL;
const API_KEY = process.env.BARATOS_SOCIAIS_API_KEY;

async function callApi(params) {
  const body = new URLSearchParams({ key: API_KEY, ...params });

  const { data } = await axios.post(BASE_URL, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000,
  });

  return data;
}

module.exports = { callApi };
```

Cada endpoint abaixo é apenas uma chamada a `callApi({ action: '...', ...outrosParametros })`.

---

## 2. Endpoints

### 2.1 Listar serviços disponíveis (`services`)

Retorna a lista completa de serviços vendáveis (seguidores, curtidas, views, inscritos etc.), com preço de custo (`rate`), limites e categorias.

**Parâmetros**

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `key` | Sim | Sua API key |
| `action` | Sim | `services` |

**Exemplo de request (curl)**

```bash
curl -X POST https://baratosociais.com/api/v2 \
  -d "key=dc1af773ecee78bb3b6194f169eec871" \
  -d "action=services"
```

**Exemplo de resposta**

```json
[
  {
    "service": 1,
    "name": "Followers",
    "type": "Default",
    "category": "First Category",
    "rate": "0.90",
    "min": "50",
    "max": "10000",
    "refill": true,
    "cancel": true
  },
  {
    "service": 2,
    "name": "Comments",
    "type": "Custom Comments",
    "category": "Second Category",
    "rate": "8",
    "min": "10",
    "max": "1500",
    "refill": false,
    "cancel": true
  }
]
```

> `rate` é o **custo por 1000 unidades**, em geral USD. O preço de venda ao cliente deve ser calculado como:
> `preco_venda = rate * (quantidade / 1000) * (1 + margem_lucro_percent / 100)`
> convertendo USD → BRL se necessário, e aplicando a margem configurada pelo ADM no produto (`profit_margin_percent`).

**Uso recomendado:** cachear essa lista (ex.: 30–60 min) em um job/cron (`src/jobs/syncBaratosServices.js`), gravando/atualizando os serviços vinculados a `products.baratos_sociais_service_id`, em vez de chamar a cada requisição do usuário.

```js
async function getServices() {
  return callApi({ action: 'services' });
}
```

---

### 2.2 Criar pedido (`add`)

Cria um novo pedido de engajamento (ex.: 1000 seguidores para um perfil).

**Parâmetros**

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `key` | Sim | Sua API key |
| `action` | Sim | `add` |
| `service` | Sim | ID do serviço (retornado por `services`) |
| `link` | Sim | Link/URL do perfil ou post alvo |
| `quantity` | Sim | Quantidade desejada (respeitar `min`/`max` do serviço) |
| `runs` | Não | Número de execuções (drip-feed) |
| `interval` | Não | Intervalo em minutos entre execuções (drip-feed) |

**Exemplo de request**

```bash
curl -X POST https://baratosociais.com/api/v2 \
  -d "key=dc1af773ecee78bb3b6194f169eec871" \
  -d "action=add" \
  -d "service=1" \
  -d "link=https://instagram.com/exemplo" \
  -d "quantity=1000"
```

**Exemplo de resposta**

```json
{ "order": 23501 }
```

**Uso recomendado:** só chamar este endpoint **após confirmação de pagamento** (webhook Mercado Pago com `payment_status = PAID`). Salvar o `order` retornado em `orders.delivered_content` (ou em uma coluna dedicada, ex. `external_order_id`), e mudar `orders.order_status` para `PROCESSING`.

```js
async function createOrder({ serviceId, link, quantity, runs, interval }) {
  const params = { action: 'add', service: serviceId, link, quantity };
  if (runs) params.runs = runs;
  if (interval) params.interval = interval;
  return callApi(params);
}
```

---

### 2.3 Consultar status de um pedido (`status`)

**Parâmetros**

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `key` | Sim | Sua API key |
| `action` | Sim | `status` |
| `order` | Sim | ID do pedido |

**Exemplo de request**

```bash
curl -X POST https://baratosociais.com/api/v2 \
  -d "key=dc1af773ecee78bb3b6194f169eec871" \
  -d "action=status" \
  -d "order=23501"
```

**Exemplo de resposta**

```json
{
  "charge": "0.27819",
  "start_count": "3572",
  "status": "Partial",
  "remains": "157",
  "currency": "USD"
}
```

`status` possíveis (valores típicos de painéis SMM): `Pending`, `In progress`, `Completed`, `Partial`, `Processing`, `Canceled`.

```js
async function getOrderStatus(orderId) {
  return callApi({ action: 'status', order: orderId });
}
```

---

### 2.4 Consultar status de múltiplos pedidos (`status` com `orders`)

Até 100 IDs por chamada — útil para o job periódico que sincroniza pedidos `PROCESSING`.

**Parâmetros**

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `key` | Sim | Sua API key |
| `action` | Sim | `status` |
| `orders` | Sim | IDs separados por vírgula (máx. 100) |

**Exemplo de request**

```bash
curl -X POST https://baratosociais.com/api/v2 \
  -d "key=dc1af773ecee78bb3b6194f169eec871" \
  -d "action=status" \
  -d "orders=1,10,100"
```

**Exemplo de resposta**

```json
{
  "1": { "charge": "0.27819", "start_count": "3572", "status": "Partial", "remains": "157", "currency": "USD" },
  "10": { "error": "Incorrect order ID" },
  "100": { "charge": "1.44219", "start_count": "234", "status": "In progress", "remains": "10", "currency": "USD" }
}
```

```js
async function getMultipleOrderStatus(orderIds) {
  return callApi({ action: 'status', orders: orderIds.join(',') });
}
```

> Job sugerido: `src/jobs/syncEngagementOrders.js`, rodando a cada 5–10 min, buscando pedidos locais com `order_status = PROCESSING` e `category = ENGAJAMENTO`, agrupando em lotes de 100 e atualizando o status local (`Completed` → `COMPLETED`, etc.), postando uma mensagem de sistema no chat do pedido quando concluído.

---

### 2.5 Solicitar reenvio/reposição — refill (`refill`)

Usado quando o serviço tem `refill: true` e o cliente relata queda nos números entregues (ex.: perda de seguidores).

**Parâmetros**

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `key` | Sim | Sua API key |
| `action` | Sim | `refill` |
| `order` | Sim | ID do pedido |

**Exemplo de request**

```bash
curl -X POST https://baratosociais.com/api/v2 \
  -d "key=dc1af773ecee78bb3b6194f169eec871" \
  -d "action=refill" \
  -d "order=23501"
```

**Exemplo de resposta**

```json
{ "refill": "1" }
```

```js
async function requestRefill(orderId) {
  return callApi({ action: 'refill', order: orderId });
}
```

---

### 2.6 Solicitar refill em lote (`refill` com `orders`)

**Parâmetros**

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `key` | Sim | Sua API key |
| `action` | Sim | `refill` |
| `orders` | Sim | IDs separados por vírgula (máx. 100) |

**Exemplo de resposta**

```json
[
  { "order": 1, "refill": 1 },
  { "order": 2, "refill": 2 },
  { "order": 3, "refill": { "error": "Incorrect order ID" } }
]
```

```js
async function requestBulkRefill(orderIds) {
  return callApi({ action: 'refill', orders: orderIds.join(',') });
}
```

---

### 2.7 Consultar status de um refill (`refill_status`)

**Parâmetros**

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `key` | Sim | Sua API key |
| `action` | Sim | `refill_status` |
| `refill` | Sim | ID do refill |

**Exemplo de resposta**

```json
{ "status": "Completed" }
```

```js
async function getRefillStatus(refillId) {
  return callApi({ action: 'refill_status', refill: refillId });
}
```

---

### 2.8 Consultar status de múltiplos refills (`refill_status` com `refills`)

**Parâmetros**

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `key` | Sim | Sua API key |
| `action` | Sim | `refill_status` |
| `refills` | Sim | IDs separados por vírgula (máx. 100) |

**Exemplo de resposta**

```json
[
  { "refill": 1, "status": "Completed" },
  { "refill": 2, "status": "Rejected" },
  { "refill": 3, "status": { "error": "Refill not found" } }
]
```

```js
async function getMultipleRefillStatus(refillIds) {
  return callApi({ action: 'refill_status', refills: refillIds.join(',') });
}
```

---

### 2.9 Cancelar pedido(s) (`cancel`)

Só funciona para serviços com `cancel: true`, geralmente enquanto o pedido ainda não foi (totalmente) entregue.

**Parâmetros**

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `key` | Sim | Sua API key |
| `action` | Sim | `cancel` |
| `orders` | Sim | IDs separados por vírgula (máx. 100) — mesmo para 1 único ID |

**Exemplo de request**

```bash
curl -X POST https://baratosociais.com/api/v2 \
  -d "key=dc1af773ecee78bb3b6194f169eec871" \
  -d "action=cancel" \
  -d "orders=9,2"
```

**Exemplo de resposta**

```json
[
  { "order": 9, "cancel": { "error": "Incorrect order ID" } },
  { "order": 2, "cancel": 1 }
]
```

```js
async function cancelOrders(orderIds) {
  return callApi({ action: 'cancel', orders: orderIds.join(',') });
}
```

> Ao cancelar com sucesso (`cancel: 1`), disparar reembolso/estorno interno: criar registro em `transactions` do tipo `REFUND` e mudar `orders.order_status` para `CANCELLED`.

---

### 2.10 Consultar saldo da conta (`balance`)

Retorna o saldo disponível na conta Baratos Sociais — útil para alertar o ADM quando o saldo estiver baixo (evita falha ao criar novos pedidos).

**Parâmetros**

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `key` | Sim | Sua API key |
| `action` | Sim | `balance` |

**Exemplo de request**

```bash
curl -X POST https://baratosociais.com/api/v2 \
  -d "key=dc1af773ecee78bb3b6194f169eec871" \
  -d "action=balance"
```

**Exemplo de resposta**

```json
{ "balance": "100.84292", "currency": "USD" }
```

```js
async function getBalance() {
  return callApi({ action: 'balance' });
}
```

> Sugestão: expor em `GET /admin/baratos-sociais/balance` (rota ADM) e rodar um job diário que alerta (email/Slack) se `balance` cair abaixo de um limite configurável.

---

## 3. Cliente completo (referência)

```js
// src/services/baratosSociais.js
const axios = require('axios');

const BASE_URL = process.env.BARATOS_SOCIAIS_BASE_URL;
const API_KEY = process.env.BARATOS_SOCIAIS_API_KEY;

async function callApi(params) {
  const body = new URLSearchParams({ key: API_KEY, ...params });
  const { data } = await axios.post(BASE_URL, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000,
  });
  return data;
}

module.exports = {
  getServices: () => callApi({ action: 'services' }),

  createOrder: ({ serviceId, link, quantity, runs, interval }) => {
    const params = { action: 'add', service: serviceId, link, quantity };
    if (runs) params.runs = runs;
    if (interval) params.interval = interval;
    return callApi(params);
  },

  getOrderStatus: (orderId) => callApi({ action: 'status', order: orderId }),

  getMultipleOrderStatus: (orderIds) =>
    callApi({ action: 'status', orders: orderIds.join(',') }),

  requestRefill: (orderId) => callApi({ action: 'refill', order: orderId }),

  requestBulkRefill: (orderIds) =>
    callApi({ action: 'refill', orders: orderIds.join(',') }),

  getRefillStatus: (refillId) => callApi({ action: 'refill_status', refill: refillId }),

  getMultipleRefillStatus: (refillIds) =>
    callApi({ action: 'refill_status', refills: refillIds.join(',') }),

  cancelOrders: (orderIds) => callApi({ action: 'cancel', orders: orderIds.join(',') }),

  getBalance: () => callApi({ action: 'balance' }),
};
```

---

## 4. Tratamento de erros

A API não usa códigos HTTP diferenciados para erros de negócio — a maioria dos erros vem **dentro do corpo JSON** (ex.: `{ "error": "Incorrect order ID" }`) mesmo com HTTP 200. Portanto:

- Sempre verificar `response.error` antes de assumir sucesso, em qualquer endpoint.
- Em respostas de lote (`status`/`refill`/`refill_status`/`cancel` com múltiplos IDs), cada item pode falhar independentemente — iterar e tratar item a item.
- Envolver `callApi` em try/catch para erros de rede/timeout (a API pode ficar temporariamente indisponível), com retry exponencial (ex.: 3 tentativas) apenas para `services`, `status` e `balance` — **nunca** dar retry automático em `add` (risco de duplicar pedido/cobrança) sem idempotência própria (ex.: checar se já existe `external_order_id` para aquele `orders.id` antes de chamar novamente).

```js
async function safeCall(fn, ...args) {
  try {
    const result = await fn(...args);
    if (result && result.error) {
      throw new Error(`Baratos Sociais error: ${result.error}`);
    }
    return result;
  } catch (err) {
    // logar, notificar, etc.
    throw err;
  }
}
```

## 5. Resumo de endpoints (referência rápida)

| Ação (`action`) | Parâmetros extras | Uso |
|---|---|---|
| `services` | — | Listar todos os serviços/preços disponíveis |
| `add` | `service`, `link`, `quantity`, `runs?`, `interval?` | Criar pedido de engajamento |
| `status` | `order` **ou** `orders` (até 100) | Consultar status de 1 ou N pedidos |
| `refill` | `order` **ou** `orders` (até 100) | Solicitar reposição de 1 ou N pedidos |
| `refill_status` | `refill` **ou** `refills` (até 100) | Consultar status de 1 ou N refills |
| `cancel` | `orders` (até 100, mesmo para 1) | Cancelar 1 ou N pedidos |
| `balance` | — | Consultar saldo da conta |
