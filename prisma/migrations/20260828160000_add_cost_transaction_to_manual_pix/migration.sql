-- AlterTable
ALTER TABLE "manual_pix_payments" ADD COLUMN     "cost_transaction_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "manual_pix_payments_cost_transaction_id_key" ON "manual_pix_payments"("cost_transaction_id");
