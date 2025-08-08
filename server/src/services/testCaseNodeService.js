// services/batchResult.service.js
import { PrismaClient } from "@prisma/client";
import { convertParams } from "../helpers/convertParam.js"; // sửa đường dẫn nếu khác

const prisma = new PrismaClient();

export async function exportInputToN8n({ batchId, scenarios = [] }) {
    const errors = [];
    if (!batchId || !Array.isArray(scenarios) || scenarios.length === 0) {
        return { status: 400, success: false, message: "Invalid payload", errors: ["Invalid payload"] };
    }

    // 1) Validate Batch / Scenario / TestCase (giữ gọn)
    const scenarioIds = scenarios.map(s => s.scenarioId).filter(Boolean);
    const testCaseIds = scenarios.flatMap(s => (s.testCases || []).map(tc => tc.testCaseId).filter(Boolean));

    const [batch, scenarioRows, testCaseRows] = await Promise.all([
        prisma.testBatch.findFirst({ where: { id: batchId } }),
        prisma.scenario.findMany({ where: { id: { in: scenarioIds } }, select: { id: true } }),
        prisma.testCase.findMany({ where: { id: { in: testCaseIds } }, select: { id: true } }),
    ]);

    if (!batch) errors.push("Test batch not found");
    const existScenario = new Set(scenarioRows.map(x => x.id));
    const missScenario = scenarioIds.filter(id => !existScenario.has(id));
    if (missScenario.length) errors.push("Scenario(s) not found: " + missScenario.join(", "));

    const existTestCase = new Set(testCaseRows.map(x => x.id));
    const missTestCase = testCaseIds.filter(id => !existTestCase.has(id));
    if (missTestCase.length) errors.push("Test case(s) not found: " + missTestCase.join(", "));

    // 2) WorkflowNode
    const allNodeIds = scenarios.flatMap(s =>
        (s.testCases || []).flatMap(tc =>
            (tc.nodes || tc.nodeIds || []).map(n => n.nodeId).filter(Boolean)
        )
    );
    const uniqueNodeIds = [...new Set(allNodeIds)];
    if (uniqueNodeIds.length) {
        const wfNodes = await prisma.workflowNode.findMany({
            where: { nodeId: { in: uniqueNodeIds } }, select: { nodeId: true }
        });
        const exist = new Set(wfNodes.map(x => x.nodeId));
        const miss = uniqueNodeIds.filter(id => !exist.has(id));
        if (miss.length) errors.push("WorkflowNode(s) not found: " + miss.join(", "));
    }

    // 3) TestCaseNode preload (lấy inputParam một lần)
    const tcnPairs = scenarios.flatMap(s =>
        (s.testCases || []).flatMap(tc =>
            (tc.nodes || tc.nodeIds || []).map(n => ({ testCaseId: tc.testCaseId, nodeId: n.nodeId }))
        )
    );

    let tcnMap = new Map();
    if (tcnPairs.length) {
        const tcnRows = await prisma.testCaseNode.findMany({
            where: { OR: tcnPairs },
            select: { testCaseId: true, nodeId: true, inputParam: true }
        });
        tcnMap = new Map(tcnRows.map(r => [`${r.testCaseId}_${r.nodeId}`, r]));
        const missing = tcnPairs.filter(p => !tcnMap.has(`${p.testCaseId}_${p.nodeId}`));
        if (missing.length) {
            errors.push(
                "TestCaseNode(s) not found: " +
                missing.map(m => `[${m.testCaseId},${m.nodeId}]`).join(", ")
            );
        }
    }

    if (errors.length) {
        return { status: 400, success: false, message: errors.join(" & "), errors };
    }

    // 4) Thu thập inputParam (echo để kiểm tra) – KHÔNG update result, KHÔNG gọi n8n
    const sentInputs = [];
    for (const s of scenarios) {
        for (const tc of (s.testCases || [])) {
            const nodes = tc.nodes || tc.nodeIds || [];
            for (const n of nodes) {
                const key = `${tc.testCaseId}_${n.nodeId}`;
                const tcn = tcnMap.get(key); // đã preload ở bước 3
                const input = convertParams(Array.isArray(tcn?.inputParam) ? tcn.inputParam : []);
                // // Gửi n8n (tắt tạm)
                // await postToN8N({ scenarioId: s.scenarioId, testCaseId: tc.testCaseId, nodeId: n.nodeId, input });
                sentInputs.push({
                    scenarioId: s.scenarioId,
                    testCaseId: tc.testCaseId,
                    nodeId: n.nodeId,
                    input
                });
            }
        }
    }

    // Trả về
    return {
        status: 200,
        success: true,
        message: "Collected inputParam successfully",
        sent: sentInputs.length,
        sentInputs
    };
}
