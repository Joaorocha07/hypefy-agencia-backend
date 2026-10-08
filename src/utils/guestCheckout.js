// Produtos vendidos sem login (ex: landing /prompt-secreto) — o comprador
// informa só email + CPF e a entrega vai por email (ver notifyOrderPaid em
// order.service.js), o que não serve para contas compartilhadas, entregues
// pelo chat do pedido. Lista fixa abaixo (Prompt Secreto + ChatGPT
// compartilhado); GUEST_CHECKOUT_PRODUCT_IDS, separada por vírgula, substitui
// a lista quando definida.
const DEFAULT_GUEST_CHECKOUT_PRODUCT_IDS = [
  '746afed4-5bdf-4120-9058-e444cc563612', // Prompt Secreto
  'b0c5adc2-d74d-4e57-bd6c-0d8cdc02fd7b', // ChatGPT — acesso compartilhado
].join(',');

function isGuestCheckoutProduct(productId) {
  return (process.env.GUEST_CHECKOUT_PRODUCT_IDS || DEFAULT_GUEST_CHECKOUT_PRODUCT_IDS)
    .split(',')
    .map((id) => id.trim())
    .includes(productId);
}

module.exports = { isGuestCheckoutProduct };
