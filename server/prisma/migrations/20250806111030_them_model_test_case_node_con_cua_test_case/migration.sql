/*
  Warnings:

  - You are about to drop the column `result` on the `TestCase` table. All the data in the column will be lost.
  - You are about to drop the column `testCaseData` on the `TestCase` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[nodeId]` on the table `WorkflowNode` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."TestCase" DROP COLUMN "result",
DROP COLUMN "testCaseData",
ADD COLUMN     "name" TEXT;

-- CreateTable
CREATE TABLE "public"."TestCaseNode" (
    "id" TEXT NOT NULL,
    "inputParam" JSONB,
    "expectation" JSONB,
    "result" JSONB,
    "testCaseId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,

    CONSTRAINT "TestCaseNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TestCaseNode_testCaseId_nodeId_key" ON "public"."TestCaseNode"("testCaseId", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowNode_nodeId_key" ON "public"."WorkflowNode"("nodeId");

-- AddForeignKey
ALTER TABLE "public"."TestCaseNode" ADD CONSTRAINT "TestCaseNode_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "public"."TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TestCaseNode" ADD CONSTRAINT "TestCaseNode_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "public"."WorkflowNode"("nodeId") ON DELETE CASCADE ON UPDATE CASCADE;
