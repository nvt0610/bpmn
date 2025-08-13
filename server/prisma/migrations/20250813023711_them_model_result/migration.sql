-- AlterTable
ALTER TABLE "public"."TestBatch" ADD COLUMN     "description" TEXT,
ADD COLUMN     "name" TEXT;

-- CreateTable
CREATE TABLE "public"."Result" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "testBatchId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "testCaseNodeId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workflowNodeId" TEXT NOT NULL,
    "result" JSONB,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Result_testBatchId_idx" ON "public"."Result"("testBatchId");

-- CreateIndex
CREATE INDEX "Result_scenarioId_idx" ON "public"."Result"("scenarioId");

-- CreateIndex
CREATE INDEX "Result_testCaseId_idx" ON "public"."Result"("testCaseId");

-- CreateIndex
CREATE INDEX "Result_testCaseNodeId_idx" ON "public"."Result"("testCaseNodeId");

-- CreateIndex
CREATE INDEX "Result_workflowId_idx" ON "public"."Result"("workflowId");

-- CreateIndex
CREATE INDEX "Result_workflowNodeId_idx" ON "public"."Result"("workflowNodeId");

-- AddForeignKey
ALTER TABLE "public"."Result" ADD CONSTRAINT "Result_testBatchId_fkey" FOREIGN KEY ("testBatchId") REFERENCES "public"."TestBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Result" ADD CONSTRAINT "Result_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "public"."Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Result" ADD CONSTRAINT "Result_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "public"."TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Result" ADD CONSTRAINT "Result_testCaseNodeId_fkey" FOREIGN KEY ("testCaseNodeId") REFERENCES "public"."TestCaseNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Result" ADD CONSTRAINT "Result_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "public"."Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Result" ADD CONSTRAINT "Result_workflowNodeId_fkey" FOREIGN KEY ("workflowNodeId") REFERENCES "public"."WorkflowNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
