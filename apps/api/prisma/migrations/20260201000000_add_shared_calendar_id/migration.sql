-- Add shared_calendar_id column to families table
-- This allows family owners to designate a Google Calendar as the shared family calendar

ALTER TABLE families ADD COLUMN IF NOT EXISTS shared_calendar_id TEXT;
