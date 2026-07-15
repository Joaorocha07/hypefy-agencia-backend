-- AlterTable
ALTER TABLE "stock_items" ADD COLUMN     "last_edited_by_id" TEXT,
ADD COLUMN     "order_id" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "access_update_logs" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "recipient_count" INTEGER NOT NULL,
    "sent_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_update_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_last_edited_by_id_fkey" FOREIGN KEY ("last_edited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_update_logs" ADD CONSTRAINT "access_update_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_update_logs" ADD CONSTRAINT "access_update_logs_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
