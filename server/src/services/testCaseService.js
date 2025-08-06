import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const testCaseService = {
  getAllTestCases: async () => {
    try {
      const testCases = await prisma.testCase.findMany({
        include: {
          scenario: true, // Lấy luôn thông tin scenario nếu cần
          testCaseNodes: true,
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
          testCaseNodes: true,
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

  createTestCase: async ({ name, scenarioId }) => {
    try {
      const existingScenario = await prisma.scenario.findUnique({
        where: { id: scenarioId },
      });
      if (!existingScenario) {
        return {
          status: 404,
          message: "Scenario not found",
        };
      }
      const newTestCase = await prisma.testCase.create({
        data: {
          name: name ?? null,
          scenarioId: scenarioId ?? null,
        },
      });
      return {
        status: 201,
        success: true,
        message: "TestCase created successfully",
        data: newTestCase,
      };
    } catch (error) {
      throw new Error("Failed to create test case: " + error.message);
    }
  },

  // Controller nhận req.params.id và req.body.result
  receiveResultTestCase: async ({ testCaseId, result }) => {
    if (!testCaseId) throw new Error("Missing testCaseId");

    try {
      const testCase = await prisma.testCase.update({
        where: { id: testCaseId },
        data: { result: result ?? null },
      });

      return {
        status: 200,
        success: true,
        message: "Update result successfully",
        data: testCase,
      };
    } catch (error) {
      throw new Error("Failed to update result test case: " + error.message);
    }
  },

  createTestCaseWithNodes: async ({ name, scenarioId, testCaseNodes = [] }) => {
    try {
      const testCase = await prisma.testCase.create({
        data: { name: name ?? null, scenarioId: scenarioId ?? null }
      });

      if (testCaseNodes.length > 0) {
        const nodesData = testCaseNodes.map(node => {
          // Deep clone tránh ảnh hưởng
          const stepWithoutExpectation = JSON.parse(JSON.stringify(node.step || []));
          const expectationArr = [];

          // Duyệt từng step, từng api
          stepWithoutExpectation.forEach(step => {
            if (Array.isArray(step.apis)) {
              step.apis.forEach(api => {
                if ('expectedResponse' in api) {
                  // Lưu expectation riêng
                  expectationArr.push(api.expectedResponse);
                  // Xóa expectation khỏi inputParam
                  delete api.expectedResponse;
                }
              });
            }
          });

          return {
            inputParam: stepWithoutExpectation,   // step đã loại expectation
            expectation: expectationArr,          // chỉ chứa các expectedResponse
            nodeId: node.nodeId,
            testCaseId: testCase.id,
          };
        });

        await prisma.testCaseNode.createMany({ data: nodesData, skipDuplicates: true });
      }

      const fullTestCase = await prisma.testCase.findUnique({
        where: { id: testCase.id },
        include: { testCaseNodes: true },
      });

      return {
        status: 201,
        success: true,
        message: "Created test case and nodes successfully",
        data: fullTestCase,
      };
    } catch (error) {
      throw new Error("Failed to create test case with nodes: " + error.message);
    }
  },

  updateTestCase: async ({ id, name, scenarioId }) => {
    try {
      const testCase = await prisma.testCase.findUnique({ where: { id } });
      if (!testCase) {
        return {
          status: 404,
          success: false,
          message: "TestCase not found",
        };
      }
      if (scenarioId) {
        const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId } });
        if (!scenario) return { status: 404, success: false, message: "Scenario not found" };
      }

      const updated = await prisma.testCase.update({
        where: { id },
        data: {
          name: name ?? testCase.name,
          scenarioId: scenarioId ?? testCase.scenarioId,
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
