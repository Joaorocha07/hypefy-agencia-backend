-- Migration de sincronização: captura mudanças que foram aplicadas em produção
-- via `prisma db push` sem gerar migration (pedidos manuais / cartão de crédito,
-- role SOCIO + profit share, ordenação de categorias).
-- Já aplicada em produção — registrada com `prisma migrate resolve --applied`.

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SOCIO';

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'CREDIT_CARD';
ALTER TYPE "PaymentMethod" ADD VALUE 'DEBIT_CARD';

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "allowed_menus" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "financial_visible_from" TIMESTAMP(3),
ADD COLUMN     "profit_share_percent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cart_order_id" TEXT;

-- CreateTable
CREATE TABLE "cart_orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_price" DECIMAL(10,2) NOT NULL,
    "discount_source" TEXT,
    "coupon_code" TEXT,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'PIX',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "mercado_pago_payment_id" TEXT,
    "mercado_pago_qr_code" TEXT,
    "mercado_pago_qr_code_base64" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_pix_payments" (
    "id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "product_id" TEXT,
    "note" TEXT,
    "transaction_id" TEXT NOT NULL,
    "registered_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_pix_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cart_orders_user_id_idx" ON "cart_orders"("user_id");

-- CreateIndex
CREATE INDEX "cart_orders_payment_status_idx" ON "cart_orders"("payment_status");

-- CreateIndex
CREATE INDEX "cart_orders_created_at_idx" ON "cart_orders"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "manual_pix_payments_transaction_id_key" ON "manual_pix_payments"("transaction_id");

-- CreateIndex
CREATE INDEX "manual_pix_payments_product_id_idx" ON "manual_pix_payments"("product_id");

-- CreateIndex
CREATE INDEX "manual_pix_payments_registered_by_id_idx" ON "manual_pix_payments"("registered_by_id");

-- CreateIndex
CREATE INDEX "manual_pix_payments_created_at_idx" ON "manual_pix_payments"("created_at");

-- CreateIndex
CREATE INDEX "orders_cart_order_id_idx" ON "orders"("cart_order_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cart_order_id_fkey" FOREIGN KEY ("cart_order_id") REFERENCES "cart_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_orders" ADD CONSTRAINT "cart_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_pix_payments" ADD CONSTRAINT "manual_pix_payments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_pix_payments" ADD CONSTRAINT "manual_pix_payments_registered_by_id_fkey" FOREIGN KEY ("registered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
