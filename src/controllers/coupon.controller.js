const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const couponService = require('../services/coupon.service');

const create = asyncHandler(async (req, res) => {
  const coupon = await couponService.createCoupon(req.user.id, req.body);
  success(res, coupon, 'Cupom criado com sucesso', 201);
});

const list = asyncHandler(async (req, res) => {
  const coupons = await couponService.listCoupons(req.query);
  success(res, coupons);
});

const update = asyncHandler(async (req, res) => {
  const coupon = await couponService.updateCoupon(req.params.id, req.body);
  success(res, coupon, 'Cupom atualizado com sucesso');
});

const deactivate = asyncHandler(async (req, res) => {
  const coupon = await couponService.deactivateCoupon(req.params.id);
  success(res, coupon, 'Cupom desativado com sucesso');
});

module.exports = { create, list, update, deactivate };
