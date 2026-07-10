const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const employeeService = require('../services/employee.service');

const create = asyncHandler(async (req, res) => {
  const employee = await employeeService.createEmployee(req.body);
  success(res, employee, 'Funcionário cadastrado com sucesso', 201);
});

const list = asyncHandler(async (req, res) => {
  const employees = await employeeService.listEmployees(req.query);
  success(res, employees);
});

const setActive = asyncHandler(async (req, res) => {
  const employee = await employeeService.setEmployeeActive(req.params.id, req.body.isActive);
  success(res, employee, 'Status do funcionário atualizado');
});

module.exports = { create, list, setActive };
