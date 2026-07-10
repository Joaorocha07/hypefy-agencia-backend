-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateTable
CREATE TABLE "platforms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platforms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platforms_name_key" ON "platforms"("name");

-- Seed categories/platforms from the previous fixed enum values, preserving names
INSERT INTO "categories" ("id", "name", "updated_at")
VALUES
  (gen_random_uuid()::text, 'STREAMING', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'FERRAMENTA', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'ENGAJAMENTO', CURRENT_TIMESTAMP);

INSERT INTO "platforms" ("id", "name", "updated_at")
VALUES
  (gen_random_uuid()::text, 'INSTAGRAM', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'TIKTOK', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'YOUTUBE', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'KWAI', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'FACEBOOK', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'NETFLIX', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CANVA', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CHATGPT', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CAPCUT', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CRUNCHYROLL', CURRENT_TIMESTAMP);

-- AlterTable: add nullable FK columns to products
ALTER TABLE "products" ADD COLUMN "category_id" TEXT;
ALTER TABLE "products" ADD COLUMN "platform_id" TEXT;

-- Backfill new FK columns from the old enum columns
UPDATE "products" p SET "category_id" = c."id" FROM "categories" c WHERE c."name" = p."category"::text;
UPDATE "products" p SET "platform_id" = pl."id" FROM "platforms" pl WHERE pl."name" = p."platform"::text;

-- Enforce NOT NULL now that every row has been backfilled
ALTER TABLE "products" ALTER COLUMN "category_id" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "platform_id" SET NOT NULL;

-- Drop old enum columns
ALTER TABLE "products" DROP COLUMN "category";
ALTER TABLE "products" DROP COLUMN "platform";

-- Drop now-unused enum types
DROP TYPE "ProductCategory";
DROP TYPE "ProductPlatform";

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
