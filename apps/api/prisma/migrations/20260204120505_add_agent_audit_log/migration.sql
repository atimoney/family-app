-- CreateTable
CREATE TABLE "agent_audit_logs" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "success" BOOLEAN NOT NULL,
    "error_message" TEXT,
    "execution_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_audit_logs_user_id_created_at_idx" ON "agent_audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_audit_logs_family_id_created_at_idx" ON "agent_audit_logs"("family_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_audit_logs_tool_name_created_at_idx" ON "agent_audit_logs"("tool_name", "created_at");

-- CreateIndex
CREATE INDEX "agent_audit_logs_request_id_idx" ON "agent_audit_logs"("request_id");
