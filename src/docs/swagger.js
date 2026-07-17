const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Hypefy Agência — API',
      version: '1.0.0',
      description:
        'API REST para a plataforma Hypefy Agência: serviços de engajamento social (Baratos Sociais), contas de streaming/ferramentas, pagamentos via Mercado Pago (PIX) e painel administrativo.\n\n' +
        'Perfis de acesso: **ADM** (acesso total), **FUNC** (sem acesso a preços/margens/faturamento/cupons/funcionários) e **USER** (cliente).\n\n' +
        '---\n\n' +
        '### Credenciais de acesso (ambiente atual)\n\n' +
        '| Perfil | Email | Senha |\n' +
        '|---|---|---|\n' +
        '| ADM | rocha.joao.victor.50@gmail.com | Sem senha — login somente via Google OAuth |\n' +
        '| FUNC | func@hypefy.com | `mgppsLtbfMq5` |\n' +
        '| USER | test_user_3541788716@testuser.com | Desconhecida (conta pré-existente, senha salva só como hash) |\n',
    },
    servers: [{ url: '/api/v1', description: 'Servidor local / atual' }],
    tags: [
      { name: 'Auth', description: 'Cadastro, login e gestão de senha' },
      { name: 'Products - Público', description: 'Catálogo público de produtos' },
      { name: 'Products - Admin', description: 'Gestão de produtos (ADM/FUNC)' },
      { name: 'Categories', description: 'Categorias de produtos (leitura pública, gestão ADM/FUNC)' },
      { name: 'Platforms', description: 'Plataformas de produtos (leitura pública, gestão ADM/FUNC)' },
      { name: 'Stock', description: 'Gestão de estoque (credenciais/contas)' },
      { name: 'Customers', description: 'Clientes cadastrados e histórico de compras' },
      { name: 'Engagement', description: 'Integração com a API Baratos Sociais e margens de lucro' },
      { name: 'Orders', description: 'Pedidos e checkout (PIX via Mercado Pago)' },
      { name: 'Coupons', description: 'Cupons promocionais (ADM only)' },
      { name: 'Chat', description: 'Chat de suporte/entrega por pedido' },
      { name: 'Employees', description: 'Gestão de funcionários (ADM only)' },
      { name: 'Dashboard', description: 'Faturamento e relatórios financeiros (ADM only)' },
      { name: 'Webhooks', description: 'Notificações de sistemas externos' },
      { name: 'Reviews', description: 'Avaliações de produtos e respostas do suporte (ADM/FUNC)' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', nullable: true },
          },
        },
        ApiError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            details: { type: 'object', nullable: true },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            avatarUrl: { type: 'string', nullable: true },
            role: { type: 'string', enum: ['ADM', 'FUNC', 'USER'] },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        AuthTokens: {
          type: 'object',
          properties: {
            user: { $ref: '#/components/schemas/User' },
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            imageUrl: { type: 'string', nullable: true },
            price: { type: 'number', format: 'decimal' },
            costPrice: { type: 'number', format: 'decimal', nullable: true, description: 'Somente ADM' },
            stockQuantity: { type: 'integer' },
            accessDurationDays: {
              type: 'integer',
              nullable: true,
              description: 'Dias que o acesso vendido permanece válido (ex: 30 para "1 mês"). Usado por /stock/products/{productId}/notify-access-update para decidir quem ainda está no prazo.',
            },
            categoryId: { type: 'string', format: 'uuid' },
            platformId: { type: 'string', format: 'uuid' },
            category: { $ref: '#/components/schemas/Category' },
            platform: { $ref: '#/components/schemas/Platform' },
            baratosSociaisServiceId: { type: 'string', nullable: true },
            profitMarginPercent: { type: 'number', nullable: true, description: 'Somente ADM' },
            isActive: { type: 'boolean' },
            isFeatured: { type: 'boolean', description: 'Exibido na seção "Em destaque" da loja — controlado pelo ADM/FUNC' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Platform: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            logoUrl: { type: 'string', nullable: true },
            color: { type: 'string', nullable: true, description: 'Hex #RRGGBB' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Review: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            rating: { type: 'integer', minimum: 1, maximum: 5 },
            comment: { type: 'string', nullable: true },
            adminReply: { type: 'string', nullable: true },
            adminRepliedAt: { type: 'string', format: 'date-time', nullable: true },
            isOwn: { type: 'boolean', description: 'true se esta avaliação é do usuário autenticado na requisição' },
            canEdit: { type: 'boolean', description: 'true se isOwn e ainda dentro da janela de 7 dias para editar' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string', nullable: true },
                avatarUrl: { type: 'string', nullable: true },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ReviewList: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { $ref: '#/components/schemas/Review' } },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            pages: { type: 'integer' },
            average: { type: 'number', description: 'Média das notas, 0 se não houver avaliações' },
            distribution: {
              type: 'object',
              description: 'Contagem de avaliações por nota (chaves 1 a 5)',
              properties: {
                '5': { type: 'integer' },
                '4': { type: 'integer' },
                '3': { type: 'integer' },
                '2': { type: 'integer' },
                '1': { type: 'integer' },
              },
            },
            myReview: { allOf: [{ $ref: '#/components/schemas/Review' }], nullable: true },
            canReview: { type: 'boolean', description: 'true se autenticado, comprou o produto e ainda não avaliou' },
          },
        },
        StockItem: {
          type: 'object',
          description: 'Uma vaga individual — GET /stock/products/{productId}.',
          properties: {
            id: { type: 'string', format: 'uuid' },
            isSold: { type: 'boolean' },
            soldToUserId: { type: 'string', format: 'uuid', nullable: true },
            soldAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        StockAccount: {
          type: 'object',
          description: 'Uma "conta" agrupada — GET /stock/products/{productId}/accounts retorna uma linha por content distinto, somando as vagas (StockItem rows) que compartilham aquela credencial.',
          properties: {
            id: { type: 'string', format: 'uuid', description: 'Vaga representante do grupo (uma disponível, se houver) — usar como itemId em PUT /stock/items/{itemId}.' },
            content: { type: 'string', description: 'Credenciais/link da conta.' },
            available: { type: 'integer', description: 'Vagas disponíveis com esta credencial.' },
            sold: { type: 'integer', description: 'Vagas já vendidas com esta credencial.' },
            createdAt: { type: 'string', format: 'date-time', description: 'Data da vaga mais antiga do grupo.' },
            lastSoldAt: { type: 'string', format: 'date-time', nullable: true, description: 'Data da venda mais recente do grupo, se houver.' },
            lastEditedAt: { type: 'string', format: 'date-time', description: 'Última vez que o content deste grupo foi alterado.' },
            lastEditedByName: { type: 'string', nullable: true, description: 'Quem fez a última edição, se houver (null para contas nunca editadas após o cadastro).' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            productId: { type: 'string', format: 'uuid' },
            quantity: { type: 'integer' },
            unitPrice: { type: 'number' },
            totalPrice: { type: 'number' },
            discountAmount: { type: 'number' },
            couponCode: { type: 'string', nullable: true },
            paymentMethod: { type: 'string', enum: ['PIX'] },
            paymentStatus: { type: 'string', enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] },
            mercadoPagoPaymentId: { type: 'string', nullable: true },
            mercadoPagoQrCode: { type: 'string', nullable: true },
            mercadoPagoQrCodeBase64: { type: 'string', nullable: true },
            orderStatus: { type: 'string', enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED'] },
            targetUsername: { type: 'string', nullable: true },
            targetUrl: { type: 'string', nullable: true },
            baratosSociaisOrderId: { type: 'string', nullable: true },
            deliveredContent: { type: 'string', nullable: true },
            customerLastReadAt: { type: 'string', format: 'date-time', nullable: true },
            staffLastReadAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Coupon: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            code: { type: 'string' },
            discountType: { type: 'string', enum: ['PERCENTAGE', 'FIXED'] },
            discountValue: { type: 'number' },
            maxUses: { type: 'integer', nullable: true },
            usesCount: { type: 'integer' },
            validFrom: { type: 'string', format: 'date-time', nullable: true },
            validUntil: { type: 'string', format: 'date-time', nullable: true },
            isActive: { type: 'boolean' },
          },
        },
        ChatMessage: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            orderId: { type: 'string', format: 'uuid' },
            sender: { type: 'string', enum: ['USER', 'ADM', 'FUNC', 'SYSTEM'] },
            message: { type: 'string' },
            isDelivery: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        PaginatedResult: {
          type: 'object',
          properties: {
            items: { type: 'array', items: {} },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            pages: { type: 'integer' },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Token ausente, inválido ou expirado',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
        },
        Forbidden: {
          description: 'Perfil sem permissão para este recurso',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
        },
        NotFound: {
          description: 'Recurso não encontrado',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
        },
        ValidationError: {
          description: 'Dados inválidos',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
