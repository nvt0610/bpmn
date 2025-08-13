-- AlterTable
ALTER TABLE "public"."TestCase" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'f11c2ff4-6a38-4af8-8366-fd55c995118e';

-- AddForeignKey
ALTER TABLE "public"."TestCase" ADD CONSTRAINT "TestCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
