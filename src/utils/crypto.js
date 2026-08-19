const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey() {
  return Buffer.from(process.env.ACCOUNT_SECRET_KEY, 'hex');
}

// Retorna "iv:authTag:ciphertext" em base64 — reversível por decrypt(), ao
// contrário de hashPassword() (bcrypt), usado para senhas de contas que o
// ADM precisa consultar depois (ver src/services/sharedAccount.service.js).
function encrypt(plain) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

function decrypt(encoded) {
  const [ivB64, authTagB64, ciphertextB64] = encoded.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const plain = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()]);
  return plain.toString('utf8');
}

module.exports = { encrypt, decrypt };
