/*
  Warnings:

  - You are about to drop the `Result` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "public"."Result";

-- CreateTable
CREATE TABLE "public"."TestBatch" (
    "id" TEXT NOT NULL,

    CONSTRAINT "TestBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Scenario" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "testBatchId" TEXT NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TestCase" (
    "id" TEXT NOT NULL,
    "testCaseData" JSONB,
    "result" JSONB,
    "scenarioId" TEXT NOT NULL,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Scenario" ADD CONSTRAINT "Scenario_testBatchId_fkey" FOREIGN KEY ("testBatchId") REFERENCES "public"."TestBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TestCase" ADD CONSTRAINT "TestCase_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "public"."Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
