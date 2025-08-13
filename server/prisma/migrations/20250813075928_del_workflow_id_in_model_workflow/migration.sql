/*
  Warnings:

  - You are about to drop the column `workflowId` on the `Workflow` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Workflow_workflowId_idx";

-- AlterTable
ALTER TABLE "public"."Workflow" DROP COLUMN "workflowId";
