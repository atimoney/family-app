-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "linked_calendar_event_id" TEXT,
ADD COLUMN     "linked_calendar_id" TEXT,
ADD COLUMN     "linked_google_account_id" TEXT;

-- CreateIndex
CREATE INDEX "tasks_linked_google_account_id_idx" ON "tasks"("linked_google_account_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_linked_google_account_id_fkey" FOREIGN KEY ("linked_google_account_id") REFERENCES "GoogleAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
