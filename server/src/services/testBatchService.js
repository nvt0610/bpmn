import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const testBatchService = {
    getAllTestBatches: async () => {
        try {
            const testBatches = await prisma.testBatch.findMany({
                include: { scenarios: true },
            });
            return {
                status: 200,
                success: true,
                message: "TestBatches fetched successfully",
                data: testBatches,
            };
        } catch (error) {
            throw new Error("Failed to fetch test batches: " + error.message);
        }
    },

    getTestBatchById: async ({ id }) => {
        try {
            const testBatch = await prisma.testBatch.findUnique({
                where: { id },
                include: { scenarios: true },
            });
            if (!testBatch) {
                return {
                    status: 404,
                    success: false,
                    message: "TestBatch not found",
                };
            }
            return {
                status: 200,
                success: true,
                message: "TestBatch fetched successfully",
                data: testBatch,
            };
        } catch (error) {
            throw new Error("Failed to fetch test batch: " + error.message);
        }
    },

    receiveBatchResult: async ({ batchId, scenarios }) => {
        // 1. Validate tồn tại batch, scenario, testcase
        const scenarioIds = scenarios.map(s => s.scenarioId);
        const [existingBatch, existingScenarios] = await Promise.all([
            prisma.testBatch.findFirst({ where: { id: batchId } }),
            prisma.scenario.findMany({ where: { id: { in: scenarioIds } } }),
        ]);
        const errors = [];
        if (!existingBatch) errors.push("Test batch not found");
        const existingScenarioIds = new Set(existingScenarios.map(s => s.id));
        const missingScenarioIds = scenarioIds.filter(id => !existingScenarioIds.has(id));
        if (missingScenarioIds.length > 0) errors.push("Scenario(s) not found: " + missingScenarioIds.join(", "));

        const testCaseIds = scenarios.flatMap(s => s.testCases.map(tc => tc.testCaseId));
        const existingTestCases = await prisma.testCase.findMany({ where: { id: { in: testCaseIds } } });
        const existingTestCaseIds = new Set(existingTestCases.map(tc => tc.id));
        const missingTestCaseIds = testCaseIds.filter(id => !existingTestCaseIds.has(id));
        if (missingTestCaseIds.length > 0) errors.push("Test case(s) not found: " + missingTestCaseIds.join(", "));

        // 2. Validate toàn bộ nodeId phải tồn tại trong WorkflowNode
        const allNodeIds = scenarios.flatMap(s => s.testCases.flatMap(tc => (tc.nodeIds || []).map(n => n.nodeId)));
        const uniqueNodeIds = [...new Set(allNodeIds)];
        if (uniqueNodeIds.length > 0) {
            const existingWorkflowNodes = await prisma.workflowNode.findMany({ where: { nodeId: { in: uniqueNodeIds } } });
            const existingNodeIdSet = new Set(existingWorkflowNodes.map(n => n.nodeId));
            const missingNodeIds = uniqueNodeIds.filter(id => !existingNodeIdSet.has(id));
            if (missingNodeIds.length > 0) errors.push("WorkflowNode(s) not found: " + missingNodeIds.join(", "));
        }

        // 3. Validate TestCaseNode tồn tại
        const allTestCaseNodes = scenarios.flatMap(s => s.testCases.flatMap(tc =>
            (tc.nodeIds || []).map(n => ({
                testCaseId: tc.testCaseId,
                nodeId: n.nodeId
            }))
        ));
        if (allTestCaseNodes.length > 0) {
            const existingTestCaseNodes = await prisma.testCaseNode.findMany({
                where: { OR: allTestCaseNodes }
            });
            const nodeKeySet = new Set(existingTestCaseNodes.map(n => `${n.testCaseId}_${n.nodeId}`));
            const missingTestCaseNode = allTestCaseNodes.filter(
                n => !nodeKeySet.has(`${n.testCaseId}_${n.nodeId}`)
            );
            if (missingTestCaseNode.length > 0) {
                errors.push(
                    "TestCaseNode(s) not found: " +
                    missingTestCaseNode.map(n => `[${n.testCaseId},${n.nodeId}]`).join(", ")
                );
            }
        }

        // 4. Nếu có lỗi thì trả luôn
        if (errors.length > 0) {
            return {
                status: 400,
                success: false,
                message: errors.join(" & "),
                errors,
            };
        }

        // 5. Update result từng node
        let updated = 0;
        let failed = [];
        let updatedData = [];
        for (const scenario of scenarios) {
            for (const testCase of scenario.testCases || []) {
                for (const node of testCase.nodeIds || []) {
                    try {
                        const updatedNode = await prisma.testCaseNode.update({
                            where: {
                                testCaseId_nodeId: {
                                    testCaseId: testCase.testCaseId,
                                    nodeId: node.nodeId
                                }
                            },
                            data: { result: node.result }
                        });
                        updated++;
                        updatedData.push({
                            scenarioId: scenario.scenarioId,
                            testCaseId: testCase.testCaseId,
                            nodeId: node.nodeId,
                            result: node.result
                        });
                    } catch (error) {
                        failed.push({
                            testCaseId: testCase.testCaseId,
                            nodeId: node.nodeId,
                            message: error.message
                        });
                    }
                }
            }
        }

        return {
            status: failed.length === 0 ? 200 : 207,
            success: failed.length === 0,
            message: failed.length === 0
                ? "Batch results updated successfully"
                : "Some test cases failed to update",
            updated,
            failed,
            data: updatedData,
        };
    },
    createTestBatch: async ({ scenarios = [] }) => {
        try {
            // Gom tất cả id và name từ FE gửi lên
            const ids = scenarios.filter(item => item.id).map(item => item.id);
            const names = scenarios.filter(item => !item.id && item.scenarioName).map(item => item.scenarioName);

            // Lấy tất cả scenario theo id và theo name
            let foundScenarios = [];
            if (ids.length > 0) {
                const byId = await prisma.scenario.findMany({ where: { id: { in: ids } } });
                foundScenarios = foundScenarios.concat(byId);
            }
            if (names.length > 0) {
                const byName = await prisma.scenario.findMany({ where: { name: { in: names } } });
                foundScenarios = foundScenarios.concat(byName);
            }

            // So sánh xem có thiếu scenario nào không
            const foundIds = foundScenarios.map(s => s.id);
            const foundNames = foundScenarios.map(s => s.name);

            const missingIds = ids.filter(id => !foundIds.includes(id));
            const missingNames = names.filter(name => !foundNames.includes(name));

            if (missingIds.length > 0 || missingNames.length > 0) {
                return {
                    status: 400,
                    success: false,
                    message: "Scenario(s) not found: " +
                        [...missingIds, ...missingNames].join(", "),
                };
            }

            // Tạo testBatch và connect các scenario đã có
            const testBatch = await prisma.testBatch.create({
                data: {
                    scenarios: {
                        connect: foundScenarios.map(s => ({ id: s.id })),
                    },
                },
                include: { scenarios: true },
            });

            return {
                status: 201,
                success: true,
                message: "TestBatch created successfully",
                data: testBatch,
            };
        } catch (error) {
            throw new Error("Failed to create test batch: " + error.message);
        }
    },

    updateTestBatch: async ({ id, scenarios = [] }) => {
        try {
            const testBatch = await prisma.testBatch.findUnique({ where: { id } });
            if (!testBatch) {
                return {
                    status: 404,
                    success: false,
                    message: "TestBatch not found",
                };
            }

            // Lấy danh sách scenarioId từ body
            const scenarioIds = scenarios.map(item => item.scenarioId);

            // Lấy tất cả scenario có name thuộc danh sách truyền lên
            const foundScenarios = await prisma.scenario.findMany({
                where: { id: { in: scenarioIds } },
            });

            // Nếu thiếu thì trả lỗi
            const foundIds = foundScenarios.map(s => s.id);
            const missing = scenarioIds.filter(n => !foundIds.includes(n));
            if (missing.length > 0) {
                return {
                    status: 400,
                    success: false,
                    message: "Scenario(s) not found: " + missing.join(", "),
                };
            }

            // Update batch: set lại tất cả scenario id mới
            const updated = await prisma.testBatch.update({
                where: { id },
                data: {
                    scenarios: {
                        set: foundScenarios.map(s => ({ id: s.id })),
                    },
                },
                include: { scenarios: true },
            });

            return {
                status: 200,
                success: true,
                message: "TestBatch updated successfully",
                data: updated,
            };
        } catch (error) {
            throw new Error("Failed to update test batch: " + error.message);
        }
    },

    deleteTestBatch: async ({ id }) => {
        try {
            const testBatch = await prisma.testBatch.findUnique({ where: { id } });
            if (!testBatch) {
                return {
                    status: 404,
                    success: false,
                    message: "TestBatch not found",
                };
            }
            await prisma.testBatch.delete({ where: { id } });
            return {
                status: 200,
                success: true,
                message: "TestBatch deleted successfully",
            };
        } catch (error) {
            throw new Error("Failed to delete test batch: " + error.message);
        }
    },
};

export default testBatchService;
