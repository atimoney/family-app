-- E1: Add event metadata columns for categories, audience, and category-specific data
-- This migration is ADDITIVE and NON-BREAKING

-- Add new columns to CalendarEventMetadata table
ALTER TABLE "CalendarEventMetadata" 
ADD COLUMN IF NOT EXISTS "category" VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS "audience" VARCHAR(20) NULL DEFAULT 'family',
ADD COLUMN IF NOT EXISTS "categoryMetadata" JSONB NULL DEFAULT '{}';

-- Add an index for category filtering (optional but useful for queries)
CREATE INDEX IF NOT EXISTS "CalendarEventMetadata_category_idx" ON "CalendarEventMetadata" ("category");

-- Comments for documentation
COMMENT ON COLUMN "CalendarEventMetadata"."category" IS 'E1: Event category (Meal, School, Sport, Activity, Chore, Appointment, Work, Travel, Home, Admin)';
COMMENT ON COLUMN "CalendarEventMetadata"."audience" IS 'E1: Target audience (family, adults, kids). Defaults to family.';
COMMENT ON COLUMN "CalendarEventMetadata"."categoryMetadata" IS 'E1: Category-specific metadata stored as JSONB';
