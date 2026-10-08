// Produtos vendidos sem login (ex: landing /prompt-secreto) — o comprador
// informa só email + CPF e a entrega vai por email (ver notifyOrderPaid em
// order.service.js), o que não serve para contas compartilhadas, entregues
// pelo chat do pedido. Lista separada por vírgula em GUEST_CHECKOUT_PRODUCT_IDS.
function isGuestCheckoutProduct(productId) {
  return (process.env.GUEST_CHECKOUT_PRODUCT_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .includes(productId);
}

module.exports = { isGuestCheckoutProduct };
