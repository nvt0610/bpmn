import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const resultReceiveService = {
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
        // 5) Update result từng node (Node.js)
        let updated = 0;
        const failed = [];
        const updatedData = [];

        for (const scenario of scenarios) {
            for (const testCase of (scenario.testCases || [])) {
                const nodes = testCase.nodes || testCase.nodeIds || [];
                for (const node of nodes) {
                    try {
                        await prisma.testCaseNode.update({
                            where: {
                                testCaseId_nodeId: {
                                    testCaseId: testCase.testCaseId,
                                    nodeId: node.nodeId
                                }
                            },
                            data: {
                                ...(typeof node.result !== "undefined" && { result: node.result }),
                                ...(typeof node.inputParam !== "undefined" && { inputParam: node.inputParam }),
                                ...(typeof node.expectation !== "undefined" && { expectation: node.expectation })
                            }
                        });

                        updated++;
                        updatedData.push({
                            scenarioId: scenario.scenarioId,
                            testCaseId: testCase.testCaseId,
                            nodeId: node.nodeId,
                            result: node.result
                        });
                    } catch (err) {
                        failed.push({
                            testCaseId: testCase.testCaseId,
                            nodeId: node.nodeId,
                            message: (err && err.message) || String(err)
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
    }
};

export default resultReceiveService;