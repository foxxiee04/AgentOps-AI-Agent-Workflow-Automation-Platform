-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "workspaceId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Notification_type_createdAt_idx" ON "Notification"("type", "createdAt");
