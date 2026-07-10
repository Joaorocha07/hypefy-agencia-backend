const prisma = require('../config/db');
const AppError = require('../utils/appError');
const { hashPassword } = require('../utils/password');

const SAFE_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

async function createEmployee({ email, name, phone, temporaryPassword }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError('Este email já está cadastrado', 409);

  const passwordHash = await hashPassword(temporaryPassword);
  return prisma.user.create({
    data: { email, name, phone, passwordHash, role: 'FUNC' },
    select: SAFE_SELECT,
  });
}

async function listEmployees({ isActive } = {}) {
  const where = { role: 'FUNC', ...(isActive !== undefined && { isActive }) };
  return prisma.user.findMany({ where, select: SAFE_SELECT, orderBy: { createdAt: 'desc' } });
}

async function setEmployeeActive(id, isActive) {
  const employee = await prisma.user.findFirst({ where: { id, role: 'FUNC' } });
  if (!employee) throw new AppError('Funcionário não encontrado', 404);

  return prisma.user.update({ where: { id }, data: { isActive }, select: SAFE_SELECT });
}

module.exports = { createEmployee, listEmployees, setEmployeeActive };
