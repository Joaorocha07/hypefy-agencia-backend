const prisma = require('../config/db');
const AppError = require('../utils/appError');
const { encrypt, decrypt } = require('../utils/crypto');

const BILLING_CYCLE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function serializeAccount(account) {
  return {
    id: account.id,
    platformName: account.platformName,
    label: account.label,
    email: account.email,
    password: decrypt(account.passwordEnc),
    loggedInCount: account.loggedInCount,
    lastPaymentDate: account.lastPaymentDate,
    // Derivado (não persistido): lastPaymentDate + 30 dias — a data de
    // cobrança prevista do próximo ciclo do plano.
    nextBillingDate: account.lastPaymentDate ? new Date(account.lastPaymentDate.getTime() + BILLING_CYCLE_DAYS * DAY_MS) : null,
    notes: account.notes,
    isActive: account.isActive,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

async function listAccounts() {
  const accounts = await prisma.sharedAccount.findMany({
    orderBy: [{ platformName: 'asc' }, { createdAt: 'asc' }],
  });
  return accounts.map(serializeAccount);
}

async function getAccountById(id) {
  const account = await prisma.sharedAccount.findUnique({ where: { id } });
  if (!account) throw new AppError('Conta não encontrada', 404);
  return account;
}

async function createAccount({ platformName, label, email, password, loggedInCount, lastPaymentDate, notes }) {
  const account = await prisma.sharedAccount.create({
    data: {
      platformName,
      label: label || null,
      email,
      passwordEnc: encrypt(password),
      loggedInCount: loggedInCount ?? 0,
      lastPaymentDate: lastPaymentDate ? new Date(lastPaymentDate) : null,
      notes: notes || null,
    },
  });
  return serializeAccount(account);
}

async function updateAccount(id, { platformName, label, email, password, loggedInCount, lastPaymentDate, notes, isActive }) {
  await getAccountById(id);

  const data = {};
  if (platformName !== undefined) data.platformName = platformName;
  if (label !== undefined) data.label = label || null;
  if (email !== undefined) data.email = email;
  if (password) data.passwordEnc = encrypt(password);
  if (loggedInCount !== undefined) data.loggedInCount = loggedInCount;
  if (lastPaymentDate !== undefined) data.lastPaymentDate = lastPaymentDate ? new Date(lastPaymentDate) : null;
  if (notes !== undefined) data.notes = notes || null;
  if (isActive !== undefined) data.isActive = isActive;

  const account = await prisma.sharedAccount.update({ where: { id }, data });
  return serializeAccount(account);
}

async function deleteAccount(id) {
  await getAccountById(id);
  await prisma.sharedAccount.delete({ where: { id } });
}

module.exports = { listAccounts, getAccountById, createAccount, updateAccount, deleteAccount };
