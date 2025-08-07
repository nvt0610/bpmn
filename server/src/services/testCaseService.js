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

  // controller nhận req.body có thể là object hoặc mảng object
createTestCaseWithNodes: async (body) => {
  const items = Array.isArray(body) ? body : [body];
  const result = [];

  for (const item of items) {
    const { scenarioId, name, nodes = [] } = item;

    // 1. Tạo testCase
    const testCase = await prisma.testCase.create({
      data: { name, scenarioId }
    });

    // 2. Xử lý node
    if (nodes.length > 0) {
      const nodesData = nodes.map(node => {
        const stepsWithoutExpectation = JSON.parse(JSON.stringify(node.steps || []));
        const expectationArr = [];
        // Quét từng step và từng api (giống logic cũ)
        stepsWithoutExpectation.forEach(step => {
          if (Array.isArray(step.inputParam)) {
            // Nếu inputParam là list api, duyệt từng api
            step.inputParam.forEach(api => {
              if ('expectedResponse' in step) {
                // Nếu expectedResponse là mảng, push từng phần tử
                if (Array.isArray(step.expectedResponse)) {
                  expectationArr.push(...step.expectedResponse);
                } else {
                  expectationArr.push(step.expectedResponse);
                }
                delete step.expectedResponse;
              }
            });
          }
        });
        return {
          inputParam: stepsWithoutExpectation,
          expectation: expectationArr,
          nodeId: node.nodeId,
          testCaseId: testCase.id,
        };
      });

      // Validate nodeId tồn tại
      const validNodeIds = await prisma.workflowNode.findMany({
        where: { nodeId: { in: nodes.map(n => n.nodeId) } },
        select: { nodeId: true }
      });
      const validNodeIdSet = new Set(validNodeIds.map(n => n.nodeId));
      const invalidNodes = nodes.filter(n => !validNodeIdSet.has(n.nodeId));
      if (invalidNodes.length > 0) {
        throw new Error(`Invalid nodeId(s): ${invalidNodes.map(n => n.nodeId).join(", ")}`);
      }
      await prisma.testCaseNode.createMany({ data: nodesData, skipDuplicates: true });
    }

    // 3. Lấy full testcase trả về (nếu cần)
    const fullTestCase = await prisma.testCase.findUnique({
      where: { id: testCase.id },
      include: { testCaseNodes: true }
    });

    result.push(fullTestCase);
  }

  return {
    status: 201,
    success: true,
    message: "Created test cases and nodes successfully",
    data: result
  };
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
