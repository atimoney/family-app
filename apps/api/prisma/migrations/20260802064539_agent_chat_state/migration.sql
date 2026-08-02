-- CreateTable
CREATE TABLE "agent_chat_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_pending_actions" (
    "token" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actions" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_pending_actions_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE INDEX "agent_chat_messages_conversation_id_created_at_idx" ON "agent_chat_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_chat_messages_family_id_created_at_idx" ON "agent_chat_messages"("family_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_pending_actions_user_id_idx" ON "agent_pending_actions"("user_id");

-- CreateIndex
CREATE INDEX "agent_pending_actions_expires_at_idx" ON "agent_pending_actions"("expires_at");
