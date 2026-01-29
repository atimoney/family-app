-- CreateTable
CREATE TABLE "event_categories" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "metadata_schema" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_categories_family_id_sort_order_idx" ON "event_categories"("family_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "event_categories_family_id_name_key" ON "event_categories"("family_id", "name");

-- AddForeignKey
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
