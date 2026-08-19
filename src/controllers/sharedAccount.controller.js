const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const sharedAccountService = require('../services/sharedAccount.service');

const list = asyncHandler(async (req, res) => {
  const accounts = await sharedAccountService.listAccounts();
  success(res, accounts);
});

const create = asyncHandler(async (req, res) => {
  const account = await sharedAccountService.createAccount(req.body);
  success(res, account, 'Conta cadastrada com sucesso', 201);
});

const update = asyncHandler(async (req, res) => {
  const account = await sharedAccountService.updateAccount(req.params.id, req.body);
  success(res, account, 'Conta atualizada com sucesso');
});

const remove = asyncHandler(async (req, res) => {
  await sharedAccountService.deleteAccount(req.params.id);
  success(res, null, 'Conta removida com sucesso');
});

module.exports = { list, create, update, remove };
