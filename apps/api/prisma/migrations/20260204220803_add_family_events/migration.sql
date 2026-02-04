-- CreateTable
CREATE TABLE "family_events" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "created_by_user_id" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_event_attendees" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_event_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "family_events_family_id_start_at_idx" ON "family_events"("family_id", "start_at");

-- CreateIndex
CREATE INDEX "family_events_family_id_end_at_idx" ON "family_events"("family_id", "end_at");

-- CreateIndex
CREATE INDEX "family_events_created_by_user_id_idx" ON "family_events"("created_by_user_id");

-- CreateIndex
CREATE INDEX "family_event_attendees_user_id_idx" ON "family_event_attendees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "family_event_attendees_event_id_user_id_key" ON "family_event_attendees"("event_id", "user_id");

-- AddForeignKey
ALTER TABLE "family_events" ADD CONSTRAINT "family_events_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_event_attendees" ADD CONSTRAINT "family_event_attendees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "family_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
