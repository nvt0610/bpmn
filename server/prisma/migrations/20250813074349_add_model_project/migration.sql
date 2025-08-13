/*
  Warnings:

  - You are about to drop the column `project` on the `Workflow` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Workflow" DROP COLUMN "project",
ADD COLUMN     "projectId" TEXT;

-- CreateTable
CREATE TABLE "public"."Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Workflow" ADD CONSTRAINT "Workflow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
