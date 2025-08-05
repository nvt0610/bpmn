import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const testCaseService = {
  getAllTestCases: async () => {
    try {
      const testCases = await prisma.testCase.findMany({
        include: {
          scenario: true, // Lấy luôn thông tin scenario nếu cần
        },
      });
      return {
        status: 200,
        success: true,
        message: "TestCases fetched successfully",
        data: testCases,
      };
    } catch (error) {
      throw new Error("Failed to fetch test cases: " + error.message);
    }
  },

  getTestCaseById: async ({ id }) => {
    try {
      const testCase = await prisma.testCase.findUnique({
        where: { id },
        include: {
          scenario: true,
        },
      });

      if (!testCase) {
        return {
          status: 404,
          success: false,
          message: "TestCase not found",
        };
      }

      return {
        status: 200,
        success: true,
        message: "TestCase fetched successfully",
        data: testCase,
      };
    } catch (error) {
      throw new Error("Failed to fetch test case: " + error.message);
    }
  },

  createTestCase: async ({ testCaseData, scenarioId }) => {
    try {
      const testCase = await prisma.testCase.create({
        data: {
          testCaseData: testCaseData ?? null,
          scenarioId: scenarioId ?? null,
        },
      });

      return {
        status: 201,
        success: true,
        message: "TestCase created successfully",
        data: testCase,
      };
    } catch (error) {
      throw new Error("Failed to create test case: " + error.message);
    }
  },

  // Controller nhận req.params.id và req.body.result
  receiveResultTestCase: async ({ id, result }) => {
    try {
      const testCase = await prisma.testCase.upsert({
        where: { id },  // id là string
        update: { result: result ?? null },
        create: { id, result: result ?? null },
      });

      return {
        status: 200,
        success: true,
        message: "Upsert result successfully",
        data: testCase,
      };
    } catch (error) {
      throw new Error("Failed to upsert result test case: " + error.message);
    }
  },

  updateTestCase: async ({ id, testCaseData, result, scenarioId }) => {
    try {
      const testCase = await prisma.testCase.findUnique({ where: { id } });
      if (!testCase) {
        return {
          status: 404,
          success: false,
          message: "TestCase not found",
        };
      }

      const updated = await prisma.testCase.update({
        where: { id },
        data: {
          testCaseData: testCaseData ?? null,
          result: result ?? null,
          scenarioId: scenarioId ?? null,
        },
      });

      return {
        status: 200,
        success: true,
        message: "TestCase updated successfully",
        data: updated,
      };
    } catch (error) {
      throw new Error("Failed to update test case: " + error.message);
    }
  },

  deleteTestCase: async ({ id }) => {
    try {
      const testCase = await prisma.testCase.findUnique({ where: { id } });
      if (!testCase) {
        return {
          status: 404,
          success: false,
          message: "TestCase not found",
        };
      }

      await prisma.testCase.delete({ where: { id } });

      return {
        status: 200,
        success: true,
        message: "TestCase deleted successfully",
      };
    } catch (error) {
      throw new Error("Failed to delete test case: " + error.message);
    }
  },
};

export default testCaseService;
