const crypto = require('crypto');
const prisma = require('../config/db');
const { sendMail } = require('../config/mailer');

const REQUEST_TYPE_LABELS = {
  confirmacao: 'Confirmação de tratamento de dados',
  acesso: 'Acesso aos dados pessoais',
  correcao: 'Correção de dados',
  exclusao: 'Eliminação/exclusão de dados',
  portabilidade: 'Portabilidade de dados',
  anonimizacao: 'Anonimização ou bloqueio de dados',
  revogacao: 'Revogação de consentimento',
  compartilhamentos: 'Informação sobre compartilhamentos',
  outro: 'Outra solicitação',
};

function generateProtocol() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `LGPD-${timestamp}-${random}`;
}

async function createRequest({ name, email, cpf, type, message, ip }) {
  const protocol = generateProtocol();

  const record = await prisma.lgpdRequest.create({
    data: { protocol, name, email, cpf: cpf || null, type, message: message || null, ip: ip || null },
  });

  const dpoEmail = process.env.DPO_EMAIL;
  if (dpoEmail) {
    try {
      await sendMail({
        to: dpoEmail,
        subject: `[LGPD] Nova solicitação de titular — ${protocol}`,
        html: `<p>Nova solicitação de direitos do titular recebida.</p>
               <ul>
                 <li><strong>Protocolo:</strong> ${protocol}</li>
                 <li><strong>Tipo:</strong> ${REQUEST_TYPE_LABELS[type] || type}</li>
                 <li><strong>Nome:</strong> ${name}</li>
                 <li><strong>Email:</strong> ${email}</li>
                 <li><strong>Mensagem:</strong> ${message || '(nenhuma)'}</li>
               </ul>
               <p>Prazo legal de resposta: 15 dias corridos a partir do recebimento.</p>`,
      });
    } catch (err) {
      // A solicitação já foi persistida no banco — a falha no envio do email
      // não deve impedir o titular de receber o protocolo de confirmação.
      console.error('[lgpd] falha ao notificar DPO por email:', err.message);
    }
  }

  return { protocol: record.protocol };
}

module.exports = { createRequest, REQUEST_TYPE_LABELS };
