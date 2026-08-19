-- CreateTable
CREATE TABLE "shared_accounts" (
    "id" TEXT NOT NULL,
    "platform_name" TEXT NOT NULL,
    "label" TEXT,
    "email" TEXT NOT NULL,
    "password_enc" TEXT NOT NULL,
    "logged_in_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_accounts_pkey" PRIMARY KEY ("id")
);
