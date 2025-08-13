import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n || 0));
const normStatus = (s) => (s ? String(s).trim().toLowerCase() : null);

function deriveStatus(totalNodes, resultCount) {
  if (!totalNodes || resultCount === 0) return "Not Start";
  if (resultCount === totalNodes) return "Fully";
  return "Partially";
}

const resultService = {

  getTestBatchSummary: async ({ workflowId, status }) => {
    const wantStatus = normStatus(status);

    // 1) Lọc batch theo workflowId (nếu có)
    const batchWhere = workflowId
      ? { scenarios: { some: { testCases: { some: { workflowId } } } } }
      : {};

    // Lấy toàn bộ batch
    const allBatches = await prisma.testBatch.findMany({
      where: batchWhere,
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" }
    });

    if (!allBatches.length) {
      return { status: 200, success: true, message: "OK", noOfTestBatch: 0, testBatch: [] };
    }

    const batchIds = allBatches.map(b => b.id);

    // ===== Mapping scenarioId -> batchId =====
    const scenarioBatchMap = new Map(
      (
        await prisma.scenario.findMany({
          where: { testBatchId: { in: batchIds } },
          select: { id: true, testBatchId: true }
        })
      ).map(s => [s.id, s.testBatchId])
    );

    // ===== Mapping testCaseId -> batchId =====
    const testCaseBatchMap = new Map(
      (
        await prisma.testCase.findMany({
          where: {
            scenario: { testBatchId: { in: batchIds } },
            ...(workflowId ? { workflowId } : {})
          },
          select: { id: true, scenarioId: true }
        })
      ).map(tc => [tc.id, scenarioBatchMap.get(tc.scenarioId)])
    );

    // 2) Lấy số liệu groupBy (trừ phần resultRaw sẽ dùng distinct)
    const [scenarioCount, testCaseCount, nodeCount, lastUpdated] = await prisma.$transaction([
      // Đếm scenario theo batch
      prisma.scenario.groupBy({
        by: ["testBatchId"],
        where: { testBatchId: { in: batchIds } },
        _count: { _all: true }
      }),

      // Đếm testCase trực tiếp theo batch
      prisma.testCase.groupBy({
        by: ["scenarioId"],
        where: {
          scenario: { testBatchId: { in: batchIds } },
          ...(workflowId ? { workflowId } : {})
        },
        _count: { _all: true }
      }),

      // Đếm testCaseNode trực tiếp theo batch
      prisma.testCaseNode.groupBy({
        by: ["testCaseId"],
        where: {
          testCase: {
            scenario: { testBatchId: { in: batchIds } },
            ...(workflowId ? { workflowId } : {})
          }
        },
        _count: { _all: true }
      }),

      // Lấy lastUpdated theo batch
      prisma.result.groupBy({
        by: ["testBatchId"],
        where: { testBatchId: { in: batchIds }, ...(workflowId ? { workflowId } : {}) },
        _max: { updatedAt: true }
      })
    ]);

    // Đếm số testCaseNode duy nhất đã có result (distinct)
    const resultRaw = await prisma.result.findMany({
      where: { testBatchId: { in: batchIds }, ...(workflowId ? { workflowId } : {}) },
      select: { testBatchId: true, testCaseNodeId: true },
      distinct: ["testBatchId", "testCaseNodeId"]
    });

    const resultMap = new Map();
    resultRaw.forEach(r => {
      resultMap.set(r.testBatchId, (resultMap.get(r.testBatchId) || 0) + 1);
    });

    // 3) Map số lượng scenario
    const scenarioMap = new Map(scenarioCount.map(r => [r.testBatchId, r._count._all]));

    // Map số lượng testCase
    const testCaseMap = new Map();
    testCaseCount.forEach(r => {
      const batchId = scenarioBatchMap.get(r.scenarioId);
      if (batchId) testCaseMap.set(batchId, (testCaseMap.get(batchId) || 0) + r._count._all);
    });

    // Map số lượng node (testCaseNode)
    const nodeMap = new Map();
    nodeCount.forEach(r => {
      const batchId = testCaseBatchMap.get(r.testCaseId);
      if (batchId) nodeMap.set(batchId, (nodeMap.get(batchId) || 0) + r._count._all);
    });

    // Map lastUpdated
    const lastUpdatedMap = new Map(lastUpdated.map(r => [r.testBatchId, r._max.updatedAt]));

    // 4) Kết hợp dữ liệu
    const items = allBatches.map(b => {
      const totalNodes = nodeMap.get(b.id) || 0; // tổng testCaseNode trong batch
      const resCount = resultMap.get(b.id) || 0; // số node unique có result
      return {
        testBatchId: b.id,
        createdAt: b.createdAt,
        lastUpdatedAt: lastUpdatedMap.get(b.id) || null,
        noOfScenarios: scenarioMap.get(b.id) || 0,
        noOfTestCase: testCaseMap.get(b.id) || 0,
        noOfTestCaseNode: totalNodes, // ✅ thêm field này
        noOfResult: resCount,
        status: deriveStatus(totalNodes, resCount),
        Process: `${resCount}/${totalNodes}`
      };
    });

    // 5) Lọc theo status nếu có
    const filtered = wantStatus
      ? items.filter(i => normStatus(i.status) === wantStatus)
      : items;

    // 6) Sort kết quả
    filtered.sort((a, b) => {
      const aT = a.lastUpdatedAt ? new Date(a.lastUpdatedAt).getTime() : -1;
      const bT = b.lastUpdatedAt ? new Date(b.lastUpdatedAt).getTime() : -1;
      if (bT !== aT) return bT - aT;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return {
      status: 200,
      success: true,
      message: "Fetched test batch summary successfully",
      noOfTestBatch: filtered.length,
      testBatch: filtered
    };
  },

  // ===== CRUD Result =====
  getAllResults: async () => {
    const results = await prisma.result.findMany();
    return { status: 200, success: true, message: "Results fetched successfully", data: results };
  },

  getResultById: async ({ id }) => {
    const result = await prisma.result.findUnique({ where: { id } });
    if (!result) return { status: 404, success: false, message: "Result not found" };
    return { status: 200, success: true, message: "Result fetched successfully", data: result };
  },

  createResult: async (data) => {
    const created = await prisma.result.create({ data });
    return { status: 201, success: true, message: "Result created successfully", data: created };
  },

  updateResult: async ({ id, ...data }) => {
    const existing = await prisma.result.findUnique({ where: { id } });
    if (!existing) return { status: 404, success: false, message: "Result not found" };
    const updated = await prisma.result.update({ where: { id }, data });
    return { status: 200, success: true, message: "Result updated successfully", data: updated };
  },

  deleteResult: async ({ id }) => {
    const existing = await prisma.result.findUnique({ where: { id } });
    if (!existing) return { status: 404, success: false, message: "Result not found" };
    await prisma.result.delete({ where: { id } });
    return { status: 200, success: true, message: "Result deleted successfully" };
  }
};

export default resultService;
