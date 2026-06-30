-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'config',
    "llmModel" TEXT NOT NULL DEFAULT 'gpt-4-turbo',
    "llmBaseUrl" TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
    "llmApiKey" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Settings_id_key" ON "Settings"("id");
