// services/batchResult.service.js
import { PrismaClient, Prisma } from "@prisma/client"; // <- thêm Prisma
import {
    convertParams,
    mapToDTO,
    includeSelect,
    buildWhereFromFilters
} from "../helpers/helper.js";

const prisma = new PrismaClient();

const BASE_QUERY = { include: includeSelect, orderBy: { createdAt: 'desc' } };

async function queryWithPaging(where, { page = 1, pageSize = 50 } = {}) {
    const p = Math.max(+page || 1, 1);
    const ps = Math.min(Math.max(+pageSize || 50, 1), 200);
    const [items, total] = await Promise.all([
        prisma.testCaseNode.findMany({ where, ...BASE_QUERY, skip: (p - 1) * ps, take: ps }),
        prisma.testCaseNode.count({ where })
    ]);
    return { page: p, pageSize: ps, total, items: items.map(mapToDTO) };
}

const testCaseNodeService = {
    async getAllResults({ page, pageSize } = {}) {
        const where = { result: { not: Prisma.AnyNull } };
        const data = await queryWithPaging(where, { page, pageSize });
        return { status: 200, success: true, message: "Fetched results successfully", data };
    },

    async getResultByIds(filters = {}) {
        const where = buildWhereFromFilters(filters);
        if (!Object.keys(where).length) {
            return {
                status: 400, success: false,
                message: "Cần ít nhất một filter: testCaseNodeId | testBatchId | scenarioId | testCaseId | workflowId | workflowNodeId | nodeId"
            };
        }
        const items = await prisma.testCaseNode.findMany({ where, ...BASE_QUERY });
        return {
            status: 200, success: true,
            message: "Fetched results by filters successfully",
            data: items.map(mapToDTO)
        };
    },
    async exportInputToN8n({ batchId, scenarios = [] }) {
        const errors = [];
        if (!batchId || !Array.isArray(scenarios) || !scenarios.length) {
            return { status: 400, success: false, message: "Invalid payload", errors: ["Invalid payload"] };
        }

        // helpers
        const collectNodeIds = (tc) => [
            ...((tc?.nodes ?? []).map(n => n?.nodeId).filter(Boolean)),
            ...(Array.isArray(tc?.nodeIds) ? tc.nodeIds.filter(Boolean) : [])
        ];
        const transformInputParam = (raw) => {
            if (!Array.isArray(raw)) return [];
            return raw.map(step => ({
                name: step?.name,
                inputParam: (step?.inputParam || []).map(api => ({
                    apiUrl: api?.apiUrl,
                    method: api?.method,
                    params: convertParams(api?.params || [])
                }))
            }));
        };

        // 1) Validate Batch / Scenario / TestCase
        const scenarioIds = scenarios.map(s => s.scenarioId).filter(Boolean);
        const testCaseIds = scenarios.flatMap(s => (s.testCases || []).map(tc => tc.testCaseId).filter(Boolean));

        const [batch, scenarioRows, testCaseRows] = await Promise.all([
            prisma.testBatch.findUnique({ where: { id: batchId } }),
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

        // 2) Validate WorkflowNode
        const uniqueNodeIds = new Set();
        for (const s of scenarios) {
            for (const tc of (s.testCases || [])) {
                for (const nodeId of collectNodeIds(tc)) uniqueNodeIds.add(nodeId);
            }
        }
        if (uniqueNodeIds.size) {
            const wfNodes = await prisma.workflowNode.findMany({
                where: { nodeId: { in: [...uniqueNodeIds] } },
                select: { nodeId: true }
            });
            const exist = new Set(wfNodes.map(x => x.nodeId));
            const miss = [...uniqueNodeIds].filter(id => !exist.has(id));
            if (miss.length) errors.push("WorkflowNode(s) not found: " + miss.join(", "));
        }

        // 3) Preload TestCaseNode (dedupe)
        const pairSet = new Set();
        for (const s of scenarios) {
            for (const tc of (s.testCases || [])) {
                for (const nodeId of collectNodeIds(tc)) {
                    if (tc.testCaseId && nodeId) pairSet.add(`${tc.testCaseId}::${nodeId}`); // << đổi _ -> ::
                }
            }
        }

        let tcnMap = new Map();
        if (pairSet.size) {
            const tcnPairs = [...pairSet].map(k => {
                const [testCaseId, nodeId] = k.split("::"); // << split "::"
                return { testCaseId, nodeId };
            });

            const tcnRows = await prisma.testCaseNode.findMany({
                where: { OR: tcnPairs },
                select: { testCaseId: true, nodeId: true, inputParam: true }
            });

            tcnMap = new Map(tcnRows.map(r => [`${r.testCaseId}::${r.nodeId}`, r])); // << key "::"
            const missing = [...pairSet].filter(k => !tcnMap.has(k));
            if (missing.length) errors.push("TestCaseNode(s) not found: " + missing.join(", "));
        }

        if (errors.length) {
            return { status: 400, success: false, message: errors.join(" & "), errors };
        }

        // 4) Collect inputs
        const sentInputs = [];
        for (const s of scenarios) {
            for (const tc of (s.testCases || [])) {
                for (const nodeId of collectNodeIds(tc)) {
                    const key = `${tc.testCaseId}::${nodeId}`; // << dùng "::"
                    const tcn = tcnMap.get(key);
                    const input = transformInputParam(tcn?.inputParam || []);
                    sentInputs.push({ scenarioId: s.scenarioId, testCaseId: tc.testCaseId, nodeId, input });
                }
            }
        }

        return {
            status: 200,
            success: true,
            message: "Collected inputParam successfully",
            sent: sentInputs.length,
            sentInputs
        };
    },
};

export default testCaseNodeService;
