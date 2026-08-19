const { Router } = require('express');

const authRoutes = require('./auth.routes');
const productRoutes = require('./product.routes');
const categoryRoutes = require('./category.routes');
const platformRoutes = require('./platform.routes');
const stockRoutes = require('./stock.routes');
const customerRoutes = require('./customer.routes');
const engagementRoutes = require('./engagement.routes');
const orderRoutes = require('./order.routes');
const couponRoutes = require('./coupon.routes');
const chatRoutes = require('./chat.routes');
const employeeRoutes = require('./employee.routes');
const dashboardRoutes = require('./dashboard.routes');
const webhookRoutes = require('./webhook.routes');
const reviewRoutes = require('./review.routes');
const lgpdRoutes = require('./lgpd.routes');
const sharedAccountRoutes = require('./sharedAccount.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/platforms', platformRoutes);
router.use('/stock', stockRoutes);
router.use('/customers', customerRoutes);
router.use('/engagement', engagementRoutes);
router.use('/orders', orderRoutes);
router.use('/coupons', couponRoutes);
router.use('/chat', chatRoutes);
router.use('/employees', employeeRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/reviews', reviewRoutes);
router.use('/lgpd', lgpdRoutes);
router.use('/shared-accounts', sharedAccountRoutes);

module.exports = router;
