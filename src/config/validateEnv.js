const REQUIRED_SECRETS = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
const MIN_SECRET_LENGTH = 32;
const KNOWN_WEAK_VALUES = new Set([
  'super-secret-key',
  'refresh-secret-key',
  'secret',
  'changeme',
  'change_me_run__openssl_rand_hex_32',
  'change_me_run__openssl_rand_hex_32_again',
]);

// Recusa subir o servidor com segredos de JWT ausentes/fracos — sem isso, um
// deploy que esqueça de configurar as env vars sobe silenciosamente com um
// valor previsível (ou idêntico ao .env.example), permitindo forjar tokens.
function validateEnv() {
  const problems = [];

  for (const key of REQUIRED_SECRETS) {
    const value = process.env[key];
    if (!value) {
      problems.push(`${key} não está definida.`);
    } else if (value.length < MIN_SECRET_LENGTH) {
      problems.push(`${key} tem apenas ${value.length} caracteres (mínimo ${MIN_SECRET_LENGTH}).`);
    } else if (KNOWN_WEAK_VALUES.has(value.toLowerCase())) {
      problems.push(`${key} está usando um valor de exemplo conhecido — gere um segredo real.`);
    }
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    problems.push('JWT_SECRET e JWT_REFRESH_SECRET não podem ser iguais.');
  }

  // Usada por src/utils/crypto.js (AES-256-GCM) para criptografar as senhas
  // de SharedAccount de forma reversível — precisa ser exatamente 32 bytes.
  const accountKey = process.env.ACCOUNT_SECRET_KEY;
  if (!accountKey) {
    problems.push('ACCOUNT_SECRET_KEY não está definida.');
  } else if (!/^[0-9a-fA-F]{64}$/.test(accountKey)) {
    problems.push('ACCOUNT_SECRET_KEY deve ter exatamente 64 caracteres hexadecimais (32 bytes).');
  }

  if (problems.length > 0) {
    throw new Error(
      'Configuração de ambiente insegura:\n' +
        problems.map((p) => `  - ${p}`).join('\n') +
        '\n\nGere segredos fortes com: openssl rand -hex 32'
    );
  }
}

module.exports = { validateEnv };
