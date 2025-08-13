/*
  Warnings:

  - You are about to drop the column `type` on the `Workflow` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Workflow_type_idx";

-- AlterTable
ALTER TABLE "public"."Workflow" DROP COLUMN "type";

-- DropEnum
DROP TYPE "public"."VisibilityType";
