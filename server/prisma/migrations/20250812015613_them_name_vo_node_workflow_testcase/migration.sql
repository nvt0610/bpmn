-- AlterTable
ALTER TABLE "public"."TestCaseNode" ADD COLUMN     "name" TEXT,
ADD COLUMN     "resultReceiveAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."WorkflowNode" ADD COLUMN     "name" TEXT;
