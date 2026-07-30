const axios = require('axios');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const DEFAULT_FROM = 'Hypefy Agência <no-reply@hypefy.com>';

// Envio via API HTTP do Brevo (porta 443) em vez de SMTP: PaaS como o Render
// bloqueiam/instabilizam com frequência as portas SMTP de saída (25/465/587),
// causando ETIMEDOUT na conexão. A API HTTP não sofre essa restrição.
function parseFrom(raw) {
  const match = raw.match(/^(.*)<(.+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { email: raw.trim() };
}

async function sendMail({ to, subject, html }) {
  const sender = parseFrom(process.env.SMTP_FROM || DEFAULT_FROM);

  await axios.post(
    BREVO_API_URL,
    {
      sender,
      to: [{ email: to }],
      subject,
      htmlContent: html,
    },
    {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  );
}

module.exports = { sendMail };
