/*
  Warnings:

  - Added the required column `workflowId` to the `TestCase` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."TestCase" ADD COLUMN     "workflowId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "TestCase_workflowId_idx" ON "public"."TestCase"("workflowId");

-- AddForeignKey
ALTER TABLE "public"."TestCase" ADD CONSTRAINT "TestCase_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "public"."Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
