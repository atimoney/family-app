-- CreateTable
CREATE TABLE "lists" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "nav_visibility" TEXT NOT NULL DEFAULT 'visible',
    "config" JSONB NOT NULL DEFAULT '{}',
    "icon" TEXT,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_items" (
    "id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "due_at" TIMESTAMP(3),
    "assigned_to_user_id" TEXT,
    "fields" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_list_preferences" (
    "user_id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "last_view_key" TEXT,
    "prefs" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_list_preferences_pkey" PRIMARY KEY ("user_id","list_id")
);

-- CreateIndex
CREATE INDEX "lists_family_id_idx" ON "lists"("family_id");

-- CreateIndex
CREATE INDEX "list_items_list_id_status_idx" ON "list_items"("list_id", "status");

-- CreateIndex
CREATE INDEX "list_items_list_id_sort_order_idx" ON "list_items"("list_id", "sort_order");

-- AddForeignKey
ALTER TABLE "lists" ADD CONSTRAINT "lists_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_list_preferences" ADD CONSTRAINT "user_list_preferences_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
