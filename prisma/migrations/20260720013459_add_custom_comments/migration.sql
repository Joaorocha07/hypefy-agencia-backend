-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "custom_comments" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "accepts_custom_comments" BOOLEAN NOT NULL DEFAULT false;
