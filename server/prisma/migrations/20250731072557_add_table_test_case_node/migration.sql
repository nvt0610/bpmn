/*
  Warnings:

  - You are about to drop the column `Attachments` on the `ExtraData` table. All the data in the column will be lost.
  - You are about to drop the column `nodeId` on the `ExtraData` table. All the data in the column will be lost.
  - You are about to drop the column `testCaseId` on the `ExtraData` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[testCaseNodeId,userId,roleId]` on the table `ExtraData` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `testCaseNodeId` to the `ExtraData` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ExtraData" DROP CONSTRAINT "ExtraData_testCaseId_fkey";

-- DropIndex
DROP INDEX "ExtraData_testCaseId_nodeId_userId_roleId_key";

-- AlterTable
ALTER TABLE "ExtraData" DROP COLUMN "Attachments",
DROP COLUMN "nodeId",
DROP COLUMN "testCaseId",
ADD COLUMN     "attachments" TEXT[],
ADD COLUMN     "testCaseNodeId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "TestCaseNode" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,

    CONSTRAINT "TestCaseNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TestCaseNode_testCaseId_nodeId_key" ON "TestCaseNode"("testCaseId", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtraData_testCaseNodeId_userId_roleId_key" ON "ExtraData"("testCaseNodeId", "userId", "roleId");

-- AddForeignKey
ALTER TABLE "TestCaseNode" ADD CONSTRAINT "TestCaseNode_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraData" ADD CONSTRAINT "ExtraData_testCaseNodeId_fkey" FOREIGN KEY ("testCaseNodeId") REFERENCES "TestCaseNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
