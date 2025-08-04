-- AlterTable
ALTER TABLE "public"."Scenario" ALTER COLUMN "testBatchId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."TestCase" ALTER COLUMN "scenarioId" DROP NOT NULL;
