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

async function safeCall(params) {
  const result = await callApi(params);
  if (result && result.error) {
    throw new Error(`Baratos Sociais: ${result.error}`);
  }
  return result;
}

module.exports = {
  getServices: () => safeCall({ action: 'services' }),

  createOrder: ({ serviceId, link, quantity, runs, interval }) => {
    const params = { action: 'add', service: serviceId, link, quantity };
    if (runs) params.runs = runs;
    if (interval) params.interval = interval;
    return safeCall(params);
  },

  getOrderStatus: (orderId) => safeCall({ action: 'status', order: orderId }),

  getMultipleOrderStatus: (orderIds) =>
    callApi({ action: 'status', orders: orderIds.join(',') }),

  requestRefill: (orderId) => safeCall({ action: 'refill', order: orderId }),

  requestBulkRefill: (orderIds) =>
    callApi({ action: 'refill', orders: orderIds.join(',') }),

  getRefillStatus: (refillId) => safeCall({ action: 'refill_status', refill: refillId }),

  getMultipleRefillStatus: (refillIds) =>
    callApi({ action: 'refill_status', refills: refillIds.join(',') }),

  cancelOrders: (orderIds) => callApi({ action: 'cancel', orders: orderIds.join(',') }),

  getBalance: () => safeCall({ action: 'balance' }),
};
