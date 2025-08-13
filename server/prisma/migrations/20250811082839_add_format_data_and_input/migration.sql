-- AlterTable
ALTER TABLE "public"."ConfigurationData" ADD COLUMN     "formatData" JSONB;

-- AlterTable
ALTER TABLE "public"."TestCaseNode" ADD COLUMN     "formatParam" JSONB;
