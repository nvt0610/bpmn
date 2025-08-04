/*
  Warnings:

  - A unique constraint covering the columns `[testCaseId,nodeId,userId,roleId]` on the table `ExtraData` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `roleId` to the `ExtraData` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ExtraData_testCaseId_nodeId_userId_key";

-- AlterTable
ALTER TABLE "ExtraData" ADD COLUMN     "roleId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ExtraData_testCaseId_nodeId_userId_roleId_key" ON "ExtraData"("testCaseId", "nodeId", "userId", "roleId");

-- AddForeignKey
ALTER TABLE "ExtraData" ADD CONSTRAINT "ExtraData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraData" ADD CONSTRAINT "ExtraData_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
