const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
  tls: { rejectUnauthorized: false },
  // Alguns provedores (ex.: Render) não têm rota IPv6 de saída funcional;
  // sem isso o Node tenta o endereço IPv6 resolvido do host SMTP e trava
  // até ETIMEDOUT em vez de cair para IPv4.
  family: 4,
});

async function sendMail({ to, subject, html }) {
  return transporter.sendMail({
    from: process.env.SMTP_FROM || 'Hypefy Agência <no-reply@hypefy.com>',
    to,
    subject,
    html,
  });
}

module.exports = { sendMail };
