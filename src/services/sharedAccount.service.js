const prisma = require('../config/db');
const AppError = require('../utils/appError');
const { encrypt, decrypt } = require('../utils/crypto');

function serializeAccount(account) {
  return {
    id: account.id,
    platformName: account.platformName,
    label: account.label,
    email: account.email,
    password: decrypt(account.passwordEnc),
    loggedInCount: account.loggedInCount,
    lastPaymentDate: account.lastPaymentDate,
    dueDate: account.dueDate,
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

async function createAccount({ platformName, label, email, password, loggedInCount, lastPaymentDate, dueDate, notes }) {
  const account = await prisma.sharedAccount.create({
    data: {
      platformName,
      label: label || null,
      email,
      passwordEnc: encrypt(password),
      loggedInCount: loggedInCount ?? 0,
      lastPaymentDate: lastPaymentDate ? new Date(lastPaymentDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || null,
    },
  });
  return serializeAccount(account);
}

async function updateAccount(id, { platformName, label, email, password, loggedInCount, lastPaymentDate, dueDate, notes, isActive }) {
  await getAccountById(id);

  const data = {};
  if (platformName !== undefined) data.platformName = platformName;
  if (label !== undefined) data.label = label || null;
  if (email !== undefined) data.email = email;
  if (password) data.passwordEnc = encrypt(password);
  if (loggedInCount !== undefined) data.loggedInCount = loggedInCount;
  if (lastPaymentDate !== undefined) data.lastPaymentDate = lastPaymentDate ? new Date(lastPaymentDate) : null;
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
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
