-- Platform admin console: admin flag, account suspension, last sign-in, platform-level audit rows.
ALTER TABLE "User" ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "disabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

ALTER TABLE "AuditLog" ALTER COLUMN "workspaceId" DROP NOT NULL;
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
