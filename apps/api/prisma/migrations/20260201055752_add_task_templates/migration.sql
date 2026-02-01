-- CreateTable
CREATE TABLE "task_templates" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "default_assignee_id" TEXT,
    "due_days_from_now" INTEGER,
    "due_time_of_day" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_templates_family_id_sort_order_idx" ON "task_templates"("family_id", "sort_order");

-- CreateIndex
CREATE INDEX "task_templates_family_id_deleted_at_idx" ON "task_templates"("family_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "task_templates_family_id_name_key" ON "task_templates"("family_id", "name");

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_default_assignee_id_fkey" FOREIGN KEY ("default_assignee_id") REFERENCES "family_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
