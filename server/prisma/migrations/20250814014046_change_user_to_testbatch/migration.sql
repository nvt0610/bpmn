/*
  Warnings:

  - You are about to drop the column `userId` on the `Result` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `TestCase` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Result" DROP CONSTRAINT "Result_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TestCase" DROP CONSTRAINT "TestCase_userId_fkey";

-- AlterTable
ALTER TABLE "public"."Result" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "public"."TestBatch" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'fe07b285-36db-485c-895a-be316e0542d0';

-- AlterTable
ALTER TABLE "public"."TestCase" DROP COLUMN "userId";

-- AddForeignKey
ALTER TABLE "public"."TestBatch" ADD CONSTRAINT "TestBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
