const { MercadoPagoConfig, Order } = require('mercadopago');

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
  options: { timeout: 10000 },
});

const orderClient = new Order(client);

module.exports = { client, orderClient };
