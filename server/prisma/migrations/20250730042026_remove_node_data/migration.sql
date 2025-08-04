/*
  Warnings:

  - You are about to drop the column `nodeData` on the `TestCase` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[testCaseId,nodeId,userId]` on the table `ExtraData` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ExtraData_testCaseId_nodeId_key";

-- AlterTable
ALTER TABLE "TestCase" DROP COLUMN "nodeData";

-- CreateIndex
CREATE UNIQUE INDEX "ExtraData_testCaseId_nodeId_userId_key" ON "ExtraData"("testCaseId", "nodeId", "userId");

-- AddForeignKey
ALTER TABLE "ExtraData" ADD CONSTRAINT "ExtraData_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
