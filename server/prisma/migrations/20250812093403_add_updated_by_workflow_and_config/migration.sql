/*
  Warnings:

  - You are about to drop the column `roleId` on the `ConfigurationData` table. All the data in the column will be lost.
  - You are about to drop the column `nodeId` on the `TestCaseNode` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[workflowNodeId,userId]` on the table `ConfigurationData` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[testCaseId,workflowNodeId]` on the table `TestCaseNode` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Scenario` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `TestBatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `TestCase` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `TestCaseNode` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workflowNodeId` to the `TestCaseNode` table without a default value. This is not possible if the table is not empty.
  - Made the column `updatedAt` on table `Workflow` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `WorkflowNode` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."LogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- DropForeignKey
ALTER TABLE "public"."ConfigurationData" DROP CONSTRAINT "ConfigurationData_roleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TestCaseNode" DROP CONSTRAINT "TestCaseNode_nodeId_fkey";

-- DropIndex
DROP INDEX "public"."ConfigurationData_workflowNodeId_userId_roleId_key";

-- DropIndex
DROP INDEX "public"."TestCaseNode_testCaseId_nodeId_key";

-- DropIndex
DROP INDEX "public"."WorkflowNode_nodeId_key";

-- AlterTable
ALTER TABLE "public"."ConfigurationData" DROP COLUMN "roleId",
ADD COLUMN     "updatedId" TEXT;

-- AlterTable
ALTER TABLE "public"."Scenario" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."TestBatch" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."TestCase" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."TestCaseNode" DROP COLUMN "nodeId",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "workflowNodeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Workflow" ADD COLUMN     "description" TEXT,
ADD COLUMN     "updatedId" TEXT,
ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."WorkflowNode" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "public"."AppLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message" TEXT NOT NULL,
    "level" "public"."LogLevel" NOT NULL DEFAULT 'INFO',
    "context" JSONB,
    "correlationId" TEXT,
    "source" TEXT,

    CONSTRAINT "AppLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppLog_createdAt_idx" ON "public"."AppLog"("createdAt");

-- CreateIndex
CREATE INDEX "AppLog_level_createdAt_idx" ON "public"."AppLog"("level", "createdAt");

-- CreateIndex
CREATE INDEX "AppLog_correlationId_idx" ON "public"."AppLog"("correlationId");

-- CreateIndex
CREATE INDEX "ConfigurationData_workflowNodeId_idx" ON "public"."ConfigurationData"("workflowNodeId");

-- CreateIndex
CREATE INDEX "ConfigurationData_userId_idx" ON "public"."ConfigurationData"("userId");

-- CreateIndex
CREATE INDEX "ConfigurationData_createdAt_idx" ON "public"."ConfigurationData"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigurationData_workflowNodeId_userId_key" ON "public"."ConfigurationData"("workflowNodeId", "userId");

-- CreateIndex
CREATE INDEX "Scenario_testBatchId_idx" ON "public"."Scenario"("testBatchId");

-- CreateIndex
CREATE INDEX "Scenario_createdAt_idx" ON "public"."Scenario"("createdAt");

-- CreateIndex
CREATE INDEX "TestBatch_createdAt_idx" ON "public"."TestBatch"("createdAt");

-- CreateIndex
CREATE INDEX "TestCase_scenarioId_idx" ON "public"."TestCase"("scenarioId");

-- CreateIndex
CREATE INDEX "TestCase_createdAt_idx" ON "public"."TestCase"("createdAt");

-- CreateIndex
CREATE INDEX "TestCaseNode_testCaseId_idx" ON "public"."TestCaseNode"("testCaseId");

-- CreateIndex
CREATE INDEX "TestCaseNode_workflowNodeId_idx" ON "public"."TestCaseNode"("workflowNodeId");

-- CreateIndex
CREATE INDEX "TestCaseNode_createdAt_idx" ON "public"."TestCaseNode"("createdAt");

-- CreateIndex
CREATE INDEX "TestCaseNode_resultReceiveAt_idx" ON "public"."TestCaseNode"("resultReceiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "TestCaseNode_testCaseId_workflowNodeId_key" ON "public"."TestCaseNode"("testCaseId", "workflowNodeId");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "public"."User"("roleId");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "public"."User"("createdAt");

-- CreateIndex
CREATE INDEX "Workflow_userId_idx" ON "public"."Workflow"("userId");

-- CreateIndex
CREATE INDEX "Workflow_status_idx" ON "public"."Workflow"("status");

-- CreateIndex
CREATE INDEX "Workflow_type_idx" ON "public"."Workflow"("type");

-- CreateIndex
CREATE INDEX "Workflow_workflowId_idx" ON "public"."Workflow"("workflowId");

-- CreateIndex
CREATE INDEX "Workflow_createdAt_idx" ON "public"."Workflow"("createdAt");

-- CreateIndex
CREATE INDEX "WorkflowNode_workflowId_idx" ON "public"."WorkflowNode"("workflowId");

-- CreateIndex
CREATE INDEX "WorkflowNode_nodeId_idx" ON "public"."WorkflowNode"("nodeId");

-- CreateIndex
CREATE INDEX "WorkflowNode_createdAt_idx" ON "public"."WorkflowNode"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."Workflow" ADD CONSTRAINT "Workflow_updatedId_fkey" FOREIGN KEY ("updatedId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConfigurationData" ADD CONSTRAINT "ConfigurationData_updatedId_fkey" FOREIGN KEY ("updatedId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TestCaseNode" ADD CONSTRAINT "TestCaseNode_workflowNodeId_fkey" FOREIGN KEY ("workflowNodeId") REFERENCES "public"."WorkflowNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
