/*
  Warnings:

  - You are about to drop the column `Attachments` on the `TestCase` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `TestCase` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ExtraData" ADD COLUMN     "Attachments" TEXT[],
ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "TestCase" DROP COLUMN "Attachments",
DROP COLUMN "description";
