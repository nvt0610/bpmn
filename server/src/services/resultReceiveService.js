import { PrismaClient } from "@prisma/client";
import { Log } from "../helpers/logReceive.js"; // import helper
const prisma = new PrismaClient();

const resultReceiveService = {
    receiveBatchResult: async ({ batchId, scenarios }) => {
        // 1. Validate tồn tại batch, scenario, testcase (+ ràng buộc testcase thuộc scenario)
        const scenarioIds = (scenarios || []).map(s => s.scenarioId);
        const testCaseIds = (scenarios || []).flatMap(s => (s.testCases || []).map(tc => tc.testCaseId));

        const [existingBatch, existingScenarios, existingTestCases] = await Promise.all([
            prisma.testBatch.findFirst({ where: { id: batchId } }),
            prisma.scenario.findMany({ where: { id: { in: scenarioIds } }, select: { id: true } }),
            prisma.testCase.findMany({
                where: { id: { in: testCaseIds } },
                select: { id: true, scenarioId: true, workflowId: true }
            }),
        ]);

        const errors = [];
        if (!existingBatch) errors.push("Test batch not found");

        const existingScenarioIds = new Set(existingScenarios.map(s => s.id));
        const missingScenarioIds = scenarioIds.filter(id => !existingScenarioIds.has(id));
        if (missingScenarioIds.length) errors.push("Scenario(s) not found: " + missingScenarioIds.join(", "));

        const tcMap = new Map(existingTestCases.map(tc => [tc.id, tc]));
        const missingTestCaseIds = testCaseIds.filter(id => !tcMap.has(id));
        if (missingTestCaseIds.length) errors.push("Test case(s) not found: " + missingTestCaseIds.join(", "));

        // testcase phải thuộc đúng scenario
        for (const s of (scenarios || [])) {
            for (const tc of (s.testCases || [])) {
                const db = tcMap.get(tc.testCaseId);
                if (db && db.scenarioId !== s.scenarioId) {
                    errors.push(`TestCase ${tc.testCaseId} không thuộc Scenario ${s.scenarioId}`);
                }
            }
        }

        // 2. Validate WorkflowNode
        const wfNodePairsAll = (scenarios || []).flatMap(s =>
            (s.testCases || []).flatMap(tc => {
                const db = tcMap.get(tc.testCaseId);
                if (!db) return [];
                const wfId = db.workflowId;
                const nodes = tc.nodes || tc.nodeIds || [];
                return nodes.map(n => ({ workflowId: wfId, nodeId: n.nodeId }));
            })
        );
        const wfNodeKeySet = new Set(wfNodePairsAll.map(p => `${p.workflowId}__${p.nodeId}`));
        const wfNodePairs = [...wfNodeKeySet].map(k => {
            const [workflowId, nodeId] = k.split("__");
            return { workflowId, nodeId };
        });
        if (wfNodePairs.length) {
            const existingWFNodes = await prisma.workflowNode.findMany({
                where: { OR: wfNodePairs },
                select: { workflowId: true, nodeId: true }
            });
            const okWF = new Set(existingWFNodes.map(x => `${x.workflowId}__${x.nodeId}`));
            const missingWFNodes = wfNodePairs.filter(p => !okWF.has(`${p.workflowId}__${p.nodeId}`));
            if (missingWFNodes.length) {
                errors.push(
                    "WorkflowNode(s) not found: " +
                    missingWFNodes.map(p => `[workflowId:${p.workflowId}, nodeId:${p.nodeId}]`).join(", ")
                );
            }
        }

        // 3. Validate TestCaseNode qua workflowNode.nodeId
        const allTestCaseNodes = (scenarios || []).flatMap(s =>
            (s.testCases || []).flatMap(tc =>
                (tc.nodeIds || tc.nodes || []).map(n => ({ testCaseId: tc.testCaseId, nodeId: n.nodeId }))
            )
        );

        let tcnMap = new Map();
        if (allTestCaseNodes.length) {
            const distinctTCNKeys = [...new Set(allTestCaseNodes.map(n => `${n.testCaseId}__${n.nodeId}`))];
            const distinctTCNs = distinctTCNKeys.map(k => {
                const [testCaseId, nodeId] = k.split("__");
                return { testCaseId, nodeId };
            });

            const existingTestCaseNodes = await prisma.testCaseNode.findMany({
                where: {
                    OR: distinctTCNs.map(n => ({
                        testCaseId: n.testCaseId,
                        workflowNode: { nodeId: n.nodeId }
                    }))
                },
                select: {
                    id: true,
                    testCaseId: true,
                    workflowNodeId: true,
                    workflowNode: { select: { nodeId: true } }
                }
            });

            tcnMap = new Map(
                existingTestCaseNodes.map(n => [`${n.testCaseId}__${n.workflowNode.nodeId}`, n])
            );

            const nodeKeySet = new Set(tcnMap.keys());
            const missingTestCaseNode = distinctTCNs.filter(
                n => !nodeKeySet.has(`${n.testCaseId}__${n.nodeId}`)
            );

            if (missingTestCaseNode.length) {
                errors.push(
                    "TestCaseNode(s) not found: " +
                    missingTestCaseNode.map(n => `[${n.testCaseId},${n.nodeId}]`).join(", ")
                );
            }
        }

        // 4. Nếu có lỗi thì trả luôn
        if (errors.length) {
            Log.warn("Batch result validation failed", { batchId, errors });
            return { status: 400, success: false, message: errors.join(" & "), errors };
        }

        // 5. Insert Result model (mỗi lần test -> bản ghi mới)
        let created = 0;
        const failed = [];
        const createdData = [];

        for (const scenario of (scenarios || [])) {
            for (const testCase of (scenario.testCases || [])) {
                const nodes = testCase.nodes || testCase.nodeIds || [];
                for (const node of nodes) {
                    try {
                        const tcInfo = tcMap.get(testCase.testCaseId);
                        const tcnInfo = tcnMap.get(`${testCase.testCaseId}__${node.nodeId}`);

                        if (!tcInfo || !tcnInfo) continue;

                        // Cập nhật inputParam / expectation vào TestCaseNode nếu có
                        await prisma.testCaseNode.update({
                            where: { id: tcnInfo.id },
                            data: {
                                ...(typeof node.inputParam !== "undefined" && { inputParam: node.inputParam }),
                                ...(typeof node.expectation !== "undefined" && { expectation: node.expectation })
                            }
                        });

                        // Tạo bản ghi Result mới
                        await prisma.result.create({
                            data: {
                                testBatchId: batchId,
                                scenarioId: scenario.scenarioId,
                                testCaseId: testCase.testCaseId,
                                testCaseNodeId: tcnInfo.id,
                                workflowId: tcInfo.workflowId,
                                workflowNodeId: tcnInfo.workflowNodeId,
                                result: {
                                    nodeId: node.nodeId,  // thêm nodeId vào JSON
                                    ...node.result        // merge dữ liệu result gốc từ n8n
                                }
                            }
                        });

                        created++;
                        createdData.push({
                            scenarioId: scenario.scenarioId,
                            testCaseId: testCase.testCaseId,
                            nodeId: node.nodeId,
                            result: node.result
                        });
                    } catch (err) {
                        failed.push({
                            testCaseId: testCase.testCaseId,
                            nodeId: node.nodeId,
                            message: err?.message || String(err)
                        });
                    }
                }
            }
        }

        if (failed.length) {
            Log.error("Batch result insert partially failed", { batchId, created, failed });
        } else {
            Log.info("Batch result insert completed", { batchId, created });
        }

        return {
            status: failed.length === 0 ? 200 : 207,
            success: failed.length === 0,
            message: failed.length === 0 ? "Batch results created successfully" : "Some test cases failed to insert",
            created,
            failed,
            data: createdData,
        };

    }
};

export default resultReceiveService;
