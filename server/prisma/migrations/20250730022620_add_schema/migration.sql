-- CreateEnum
CREATE TYPE "VisibilityType" AS ENUM ('GENERAL', 'ROLE_BASED');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('DRAFT', 'SUBMITTED', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "VisibilityType" NOT NULL,
    "project" TEXT,
    "status" "Status" NOT NULL DEFAULT 'DRAFT',
    "userId" TEXT NOT NULL,
    "xmlContent" TEXT NOT NULL,
    "jsonContent" JSONB,
    "nodeData" JSONB,
    "Attachments" TEXT[],

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCaseWorkflow" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "workflowId" VARCHAR(100) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestCaseWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtraData" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtraData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TestCaseWorkflow_testCaseId_key" ON "TestCaseWorkflow"("testCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtraData_testCaseId_nodeId_key" ON "ExtraData"("testCaseId", "nodeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseWorkflow" ADD CONSTRAINT "TestCaseWorkflow_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
