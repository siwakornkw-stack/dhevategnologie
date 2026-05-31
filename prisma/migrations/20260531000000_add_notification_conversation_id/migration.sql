-- Add nullable conversationId to Notification so CHAT_MESSAGE notifications can be scoped per conversation
ALTER TABLE "Notification" ADD COLUMN "conversationId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_conversationId_idx" ON "Notification"("conversationId");
