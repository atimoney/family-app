-- CreateTable
CREATE TABLE "meal_plans" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan_items" (
    "id" TEXT NOT NULL,
    "meal_plan_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "meal_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "servings" INTEGER NOT NULL DEFAULT 4,
    "prep_time" INTEGER,
    "cook_time" INTEGER,
    "tags" TEXT[],
    "recipe_url" TEXT,
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_lists" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Shopping List',
    "meal_plan_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_by_user_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopping_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_list_items" (
    "id" TEXT NOT NULL,
    "shopping_list_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "unit" TEXT,
    "category" TEXT,
    "purchased" BOOLEAN NOT NULL DEFAULT false,
    "purchased_at" TIMESTAMP(3),
    "purchased_by" TEXT,
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "source_item_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopping_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_meal_preferences" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "dietary_restrictions" TEXT[],
    "disliked_ingredients" TEXT[],
    "favorite_recipes" TEXT[],
    "default_servings" INTEGER NOT NULL DEFAULT 4,
    "prefer_quick_meals" BOOLEAN NOT NULL DEFAULT false,
    "budget_level" TEXT NOT NULL DEFAULT 'moderate',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_meal_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_preferences" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value_json" JSONB NOT NULL,
    "updated_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_preferences" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value_json" JSONB NOT NULL,
    "updated_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "person_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meal_plans_family_id_status_idx" ON "meal_plans"("family_id", "status");

-- CreateIndex
CREATE INDEX "meal_plans_created_by_user_id_idx" ON "meal_plans"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_plans_family_id_week_start_key" ON "meal_plans"("family_id", "week_start");

-- CreateIndex
CREATE INDEX "meal_plan_items_meal_plan_id_date_idx" ON "meal_plan_items"("meal_plan_id", "date");

-- CreateIndex
CREATE INDEX "meal_plan_items_meal_plan_id_meal_type_idx" ON "meal_plan_items"("meal_plan_id", "meal_type");

-- CreateIndex
CREATE INDEX "shopping_lists_family_id_status_idx" ON "shopping_lists"("family_id", "status");

-- CreateIndex
CREATE INDEX "shopping_lists_meal_plan_id_idx" ON "shopping_lists"("meal_plan_id");

-- CreateIndex
CREATE INDEX "shopping_lists_created_by_user_id_idx" ON "shopping_lists"("created_by_user_id");

-- CreateIndex
CREATE INDEX "shopping_list_items_shopping_list_id_purchased_idx" ON "shopping_list_items"("shopping_list_id", "purchased");

-- CreateIndex
CREATE INDEX "shopping_list_items_shopping_list_id_category_idx" ON "shopping_list_items"("shopping_list_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "family_meal_preferences_family_id_key" ON "family_meal_preferences"("family_id");

-- CreateIndex
CREATE INDEX "family_preferences_family_id_idx" ON "family_preferences"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "family_preferences_family_id_key_key" ON "family_preferences"("family_id", "key");

-- CreateIndex
CREATE INDEX "person_preferences_family_id_user_id_idx" ON "person_preferences"("family_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "person_preferences_family_id_user_id_key_key" ON "person_preferences"("family_id", "user_id", "key");

-- AddForeignKey
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_meal_plan_id_fkey" FOREIGN KEY ("meal_plan_id") REFERENCES "meal_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_shopping_list_id_fkey" FOREIGN KEY ("shopping_list_id") REFERENCES "shopping_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_meal_preferences" ADD CONSTRAINT "family_meal_preferences_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
