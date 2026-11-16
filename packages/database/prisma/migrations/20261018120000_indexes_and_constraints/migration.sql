-- CreateIndex
CREATE UNIQUE INDEX "AiAgentConfig_workflowId_nodeId_key" ON "AiAgentConfig"("workflowId", "nodeId");

-- CreateIndex
CREATE INDEX "AiTaskResult_workspaceId_createdAt_idx" ON "AiTaskResult"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiTaskResult_workflowRunId_nodeId_key" ON "AiTaskResult"("workflowRunId", "nodeId");

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthRefreshToken_userId_idx" ON "AuthRefreshToken"("userId");

-- CreateIndex
CREATE INDEX "DomainEvent_kafkaPublishedAt_createdAt_idx" ON "DomainEvent"("kafkaPublishedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_workspaceId_type_createdAt_idx" ON "Notification"("workspaceId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "ProcessedMessage_processedAt_idx" ON "ProcessedMessage"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ToolCallResult_workflowRunId_nodeId_key" ON "ToolCallResult"("workflowRunId", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ToolConfig_workflowId_nodeId_key" ON "ToolConfig"("workflowId", "nodeId");

-- CreateIndex
CREATE INDEX "UsageRecord_workspaceId_createdAt_idx" ON "UsageRecord"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Workflow_workspaceId_updatedAt_idx" ON "Workflow"("workspaceId", "updatedAt");

-- CreateIndex
CREATE INDEX "WorkflowRun_workspaceId_createdAt_idx" ON "WorkflowRun"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowRun_workflowId_createdAt_idx" ON "WorkflowRun"("workflowId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowRun_status_createdAt_idx" ON "WorkflowRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- AddForeignKey
ALTER TABLE "HumanApproval" ADD CONSTRAINT "HumanApproval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAgentConfig" ADD CONSTRAINT "AiAgentConfig_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTaskResult" ADD CONSTRAINT "AiTaskResult_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolConfig" ADD CONSTRAINT "ToolConfig_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCallResult" ADD CONSTRAINT "ToolCallResult_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainEvent" ADD CONSTRAINT "DomainEvent_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
