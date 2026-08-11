-- AlterTable
ALTER TABLE "products" ADD COLUMN     "manual_cost_price" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "stock_items" ADD COLUMN     "is_manual" BOOLEAN NOT NULL DEFAULT false;
