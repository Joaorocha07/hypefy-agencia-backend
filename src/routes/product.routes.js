const { Router } = require('express');
const controller = require('../controllers/product.controller');
const reviewController = require('../controllers/review.controller');
const validate = require('../middlewares/validate');
const upload = require('../middlewares/upload');
const { authenticate, optionalAuthenticate, authorize, attachMenu } = require('../middlewares/auth');
const {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
  setActiveSchema,
  setFeaturedSchema,
  quoteSchema,
} = require('../validators/product.validator');
const { listReviewsSchema, upsertReviewSchema } = require('../validators/review.validator');

const router = Router();

router.use(attachMenu('produtos'));

/**
 * @swagger
 * /products:
 *   get:
 *     tags: [Products - Público]
 *     summary: Listar catálogo público de produtos (ativos)
 *     security: []
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: platformId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada de produtos ativos, com categoria e plataforma (logo/cor) embutidas — sem campos financeiros/internos (costPrice, profitMarginPercent, baratosSociaisServiceId)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         items:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/Product' }
 *                         total: { type: integer }
 *                         page: { type: integer }
 *                         limit: { type: integer }
 *                         pages: { type: integer }
 */
router.get('/', validate(listProductsSchema), controller.listPublic);

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     tags: [Products - Público]
 *     summary: Detalhe de um produto ativo (dados completos para exibição no catálogo)
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Produto encontrado — inclui título, descrição, imagem, preço, estoque, categoria e plataforma (nome/logo/cor). Não inclui campos financeiros/internos (costPrice, profitMarginPercent, baratosSociaisServiceId).
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Product' } }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', controller.getOne);

/**
 * @swagger
 * /products/{id}/quote:
 *   get:
 *     tags: [Products - Público]
 *     summary: Cotação de preço para uma quantidade (produtos de engajamento — custo × margem em tempo real)
 *     description: >
 *       Para produtos que não são de engajamento, retorna simplesmente `price * quantity`.
 *       Para engajamento, calcula com a taxa ao vivo da Baratos Sociais e a margem do produto —
 *       o mesmo cálculo usado ao criar o pedido de verdade, então o valor mostrado aqui bate com
 *       o que será cobrado. `totalPrice`/`unitPrice` são sempre calculados proporcionalmente
 *       (a taxa é por 1000, então 1 unidade custa taxa/1000), mesmo se a quantidade estiver fora
 *       do `min`/`max` do serviço — `valid: false` nesse caso só indica que o pedido não pode ser
 *       fechado com essa quantidade, sem esconder o preço estimado.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: quantity
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Cotação de preço
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         unitPrice: { type: number, nullable: true }
 *                         totalPrice: { type: number, nullable: true }
 *                         min: { type: number, nullable: true }
 *                         max: { type: number, nullable: true }
 *                         valid: { type: boolean }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       503: { description: 'Serviço de engajamento indisponível no momento' }
 */
router.get('/:id/quote', validate(quoteSchema), controller.quote);

/**
 * @swagger
 * /products/{id}/reviews:
 *   get:
 *     tags: [Products - Público]
 *     summary: Listar avaliações de um produto (paginado, com média e distribuição de notas)
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 5 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [recent, rating_desc, rating_asc], default: recent }
 *     responses:
 *       200:
 *         description: >
 *           Lista paginada de avaliações. Se autenticado (token opcional), inclui `myReview`
 *           (avaliação do próprio usuário, se existir) e `canReview` (true se comprou o produto
 *           com pedido pago/concluído e ainda não avaliou).
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/ReviewList' } }
 */
router.get('/:id/reviews', optionalAuthenticate, validate(listReviewsSchema), reviewController.list);

/**
 * @swagger
 * /products/{id}/reviews:
 *   post:
 *     tags: [Products - Público]
 *     summary: Criar ou editar minha avaliação deste produto (requer compra paga e concluída)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               comment: { type: string, maxLength: 500 }
 *     responses:
 *       200:
 *         description: Avaliação criada ou atualizada (edição só é aceita até 7 dias após a criação)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Review' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: 'Produto não comprado/entregue, ou prazo de edição expirado' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/:id/reviews', authenticate, validate(upsertReviewSchema), reviewController.upsert);

/**
 * @swagger
 * /products/admin/all:
 *   get:
 *     tags: [Products - Admin]
 *     summary: Listar todos os produtos (inclui inativos) — ADM/FUNC
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: platformId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *       - in: query
 *         name: isFeatured
 *         schema: { type: boolean }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista paginada (FUNC não recebe costPrice/profitMarginPercent)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  '/admin/all',
  authenticate,
  authorize('ADM', 'FUNC'),
  validate(listProductsSchema),
  controller.listAdmin
);

/**
 * @swagger
 * /products/admin/{id}:
 *   get:
 *     tags: [Products - Admin]
 *     summary: Detalhe de um produto (inclui inativos) — ADM/FUNC
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Produto encontrado (FUNC não recebe costPrice/profitMarginPercent)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Product' } }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/admin/:id', authenticate, authorize('ADM', 'FUNC'), controller.getAdminOne);

/**
 * @swagger
 * /products/admin:
 *   post:
 *     tags: [Products - Admin]
 *     summary: Criar produto (ADM/FUNC — FUNC não pode definir price/costPrice/profitMarginPercent)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, price, categoryId, platformId]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               price: { type: number }
 *               costPrice: { type: number, description: 'Somente ADM' }
 *               categoryId: { type: string, format: uuid }
 *               platformId: { type: string, format: uuid }
 *               baratosSociaisServiceId: { type: string }
 *               profitMarginPercent: { type: number, description: 'Somente ADM' }
 *               isFeatured: { type: boolean, description: 'Exibir na seção "Em destaque" da loja' }
 *               image: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Produto criado
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Product' } }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  '/admin',
  authenticate,
  authorize('ADM', 'FUNC'),
  upload.single('image'),
  validate(createProductSchema),
  controller.create
);

/**
 * @swagger
 * /products/admin/{id}:
 *   put:
 *     tags: [Products - Admin]
 *     summary: Editar produto (ADM/FUNC — FUNC não pode alterar price/costPrice/profitMarginPercent)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               price: { type: number }
 *               costPrice: { type: number }
 *               categoryId: { type: string, format: uuid }
 *               platformId: { type: string, format: uuid }
 *               profitMarginPercent: { type: number }
 *               isActive: { type: boolean }
 *               isFeatured: { type: boolean, description: 'Exibir na seção "Em destaque" da loja' }
 *               image: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Produto atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.put(
  '/admin/:id',
  authenticate,
  authorize('ADM', 'FUNC'),
  upload.single('image'),
  validate(updateProductSchema),
  controller.update
);

/**
 * @swagger
 * /products/admin/{id}/active:
 *   patch:
 *     tags: [Products - Admin]
 *     summary: Ativar/inativar produto (ADM/FUNC)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Status atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  '/admin/:id/active',
  authenticate,
  authorize('ADM', 'FUNC'),
  validate(setActiveSchema),
  controller.setActive
);

/**
 * @swagger
 * /products/admin/{id}/featured:
 *   patch:
 *     tags: [Products - Admin]
 *     summary: Marcar/desmarcar produto como destaque na loja (ADM/FUNC)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isFeatured]
 *             properties:
 *               isFeatured: { type: boolean }
 *     responses:
 *       200:
 *         description: Destaque atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  '/admin/:id/featured',
  authenticate,
  authorize('ADM', 'FUNC'),
  validate(setFeaturedSchema),
  controller.setFeatured
);

/**
 * @swagger
 * /products/admin/{id}:
 *   delete:
 *     tags: [Products - Admin]
 *     summary: Excluir produto — ADM/FUNC
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Produto excluído
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { description: 'Produto possui estoque ou pedidos vinculados; inative-o em vez de excluir' }
 */
router.delete('/admin/:id', authenticate, authorize('ADM', 'FUNC'), controller.remove);

module.exports = router;
