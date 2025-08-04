/*
  Warnings:

  - You are about to drop the `ExtraData` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TestCase` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TestCaseNode` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TestCaseWorkflow` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."ExtraData" DROP CONSTRAINT "ExtraData_roleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ExtraData" DROP CONSTRAINT "ExtraData_testCaseNodeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ExtraData" DROP CONSTRAINT "ExtraData_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TestCase" DROP CONSTRAINT "TestCase_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TestCaseNode" DROP CONSTRAINT "TestCaseNode_testCaseId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TestCaseWorkflow" DROP CONSTRAINT "TestCaseWorkflow_testCaseId_fkey";

-- DropTable
DROP TABLE "public"."ExtraData";

-- DropTable
DROP TABLE "public"."TestCase";

-- DropTable
DROP TABLE "public"."TestCaseNode";

-- DropTable
DROP TABLE "public"."TestCaseWorkflow";

-- CreateTable
CREATE TABLE "public"."Workflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "public"."VisibilityType" NOT NULL DEFAULT 'GENERAL',
    "project" TEXT,
    "status" "public"."Status" NOT NULL DEFAULT 'DRAFT',
    "workflowId" VARCHAR(100) NOT NULL,
    "userId" TEXT NOT NULL,
    "xmlContent" TEXT,
    "jsonContent" JSONB,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkflowNode" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,

    CONSTRAINT "WorkflowNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConfigurationData" (
    "id" TEXT NOT NULL,
    "workflowNodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "description" TEXT,
    "data" JSONB,
    "attachments" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigurationData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowNode_workflowId_nodeId_key" ON "public"."WorkflowNode"("workflowId", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigurationData_workflowNodeId_userId_roleId_key" ON "public"."ConfigurationData"("workflowNodeId", "userId", "roleId");

-- AddForeignKey
ALTER TABLE "public"."Workflow" ADD CONSTRAINT "Workflow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkflowNode" ADD CONSTRAINT "WorkflowNode_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "public"."Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConfigurationData" ADD CONSTRAINT "ConfigurationData_workflowNodeId_fkey" FOREIGN KEY ("workflowNodeId") REFERENCES "public"."WorkflowNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConfigurationData" ADD CONSTRAINT "ConfigurationData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConfigurationData" ADD CONSTRAINT "ConfigurationData_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
