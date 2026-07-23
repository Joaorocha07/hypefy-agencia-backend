const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const authService = require('../services/auth.service');
const prisma = require('../config/db');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  success(res, result, 'Cadastro realizado com sucesso', 201);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  success(res, result, 'Login realizado com sucesso');
});

const googleLogin = asyncHandler(async (req, res) => {
  const result = await authService.loginWithGoogle(req.body.idToken);
  success(res, result, 'Login com Google realizado com sucesso');
});

const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.body.refreshToken);
  success(res, result, 'Token renovado');
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  success(res, null, 'Logout realizado com sucesso');
});

const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  success(res, null, 'Se o email existir, um link de redefinição foi enviado');
});

const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);
  success(res, null, 'Senha redefinida com sucesso');
});

const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.id, req.body);
  success(res, null, 'Senha alterada com sucesso');
});

const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  success(res, authService.toPublicUser(user));
});

const updateMe = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(req.user.id, req.body, req.file);
  success(res, user, 'Perfil atualizado com sucesso');
});

module.exports = {
  register,
  login,
  googleLogin,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  me,
  updateMe,
};
