import { Prisma } from "@prisma/client";

export function convertParams(list) {
  if (!Array.isArray(list)) return {};
  const toObject = (row) => {
    if (Array.isArray(row)) return convertParams(row);
    if (row && typeof row === 'object' && 'key' in row) return convertParams([row]);
    return row;
  };
  const out = {};
  for (const item of list) {
    if (!item || typeof item !== 'object' || !('key' in item)) continue;
    const { key, value, values, dataType } = item;
    const isList = (Array.isArray(values) && values.length > 0) || /^List/i.test(dataType || '');
    out[key] = isList ? (values || []).map(toObject) : value;
  }
  return out;
}
export const includeSelect = {
  testCase: {
    select: {
      id: true,
      workflowId: true,
      scenario: { select: { id: true, testBatch: { select: { id: true } } } }
    }
  },
  workflowNode: { select: { id: true, nodeId: true, workflowId: true } }
};

export const toBool = (v) => v === true || v === 'true' || v === '1';
export const pickDefined = (obj, keys) =>
  keys.reduce((acc, k) => {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== '') acc[k] = v;
    return acc;
  }, {});

/** [HELPER] map prisma record -> DTO chuẩn yêu cầu */
export function mapToDTO(n) {
  const scenario = n?.testCase?.scenario;
  return {
    testCaseNodeId: n?.id ?? null,
    testBatchId: scenario?.testBatch?.id ?? null,
    scenarioId: scenario?.id ?? null,
    testCaseId: n?.testCase?.id ?? null,
    workflowId: n?.testCase?.workflowId ?? null,
    workflowNodeId: n?.workflowNode?.id ?? null,
    nodeId: n?.workflowNode?.nodeId ?? null, // nodeId của WorkflowNode
    result: n?.result ?? null
  };
}

/** [HELPER] build where từ bộ filter id (giữ tối giản & an toàn) */
export function buildWhereFromFilters({
  testCaseNodeId,     // <- thêm param này
  testBatchId,
  scenarioId,
  testCaseId,
  workflowId,
  workflowNodeId,
  nodeId,
  onlyHasResult = false
} = {}) {
  const AND = [];

  if (testCaseNodeId) AND.push({ id: testCaseNodeId }); // <- lọc trực tiếp theo PK
  if (testCaseId) AND.push({ testCaseId });
  if (scenarioId) AND.push({ testCase: { scenarioId } });
  if (testBatchId) AND.push({ testCase: { scenario: { is: { testBatchId } } } });
  if (workflowId) AND.push({ testCase: { workflowId } });
  if (workflowNodeId) AND.push({ workflowNode: { is: { id: workflowNodeId } } });
  if (nodeId) AND.push({ nodeId });
  if (onlyHasResult) AND.push({ result: { not: Prisma.AnyNull } });

  return AND.length ? { AND } : {};
}
// Helper để tránh lặp code
export const handle = (fn) => async (req, res) => {
  try {
    const result = await fn(req);
    const httpStatus = Number.isInteger(result.httpStatus) ? result.httpStatus : 200;
    res.status(httpStatus).json({
      message: result.message,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Internal Server Error" });
  }
};