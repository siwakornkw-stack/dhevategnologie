ALTER TABLE "AiChatSession" ADD COLUMN "userId" TEXT;
CREATE INDEX "AiChatSession_userId_idx" ON "AiChatSession"("userId");
