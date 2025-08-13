import { PrismaClient } from "@prisma/client";
import { Log } from "../helpers/logReceive.js"; // ghi log vào DB, KHÔNG đổi response
import { normalizeStepsV2 } from "../helpers/format-mapper.js";

const prisma = new PrismaClient();

// ---- helpers (nhẹ, tự chứa) ----
const canonicalize = (v) => {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === "object") {
    return Object.keys(v).sort().reduce((acc, k) => {
      acc[k] = canonicalize(v[k]); return acc;
    }, {});
  }
  return v;
};

const testCaseService = {

  getAllTestCases: async () => {
    try {
      const data = await prisma.testCase.findMany({
        include: {
          scenario: true,
          workflow: { select: { id: true, name: true } },
          user: { select: { id: true, username: true } }, // 🔹 Thêm user
          testCaseNodes: true
        },
        orderBy: { createdAt: "desc" }
      });
      await Log.info("TestCases fetched", { count: data.length });
      return {
        status: 200,
        success: true,
        message: "TestCases fetched successfully",
        data
      };
    } catch (error) {
      await Log.error("Failed to fetch test cases", { error: error.message });
      throw new Error("Failed to fetch test cases: " + error.message);
    }
  },

  // GET /api/v1/testcases/:id
  getTestCaseById: async ({ id }) => {
    const testCaseId = id; // đổi tên để dùng lại code cũ
    if (!testCaseId) {
      return { status: 400, success: false, message: "Missing testCaseId" };
    }

    const testCase = await prisma.testCase.findUnique({
      where: { id: testCaseId },
      select: {
        id: true,
        name: true,
        testCaseNodes: {
          select: {
            id: true,
            name: true,
            inputParam: true,
            expectation: true,
            createdAt: true,
            workflowNode: { select: { id: true, nodeId: true, name: true } },
            results: {
              select: {
                id: true,
                createdAt: true,
                result: true,
                user: { select: { username: true } }
              }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!testCase) {
      return { status: 404, success: false, message: "TestCase not found" };
    }

    return {
      status: 200,
      success: true,
      message: "Fetched TestCase detail successfully",
      data: testCase
    };
  },

  createTestCase: async (body) => {
    const items = Array.isArray(body) ? body : [body];
    const result = [];

    let totalCreatedCases = 0;
    let totalUpdatedCases = 0;
    let totalCreatedNodes = 0;
    let totalUpdatedNodes = 0;

    try {
      for (const item of items) {
        const { workflowId, scenarioId, name, userId, nodes } = item;
        const testCaseIdInput = item.testCaseId ?? item.testcaseId ?? item.id ?? null;

        const data = await prisma.$transaction(async (tx) => {
          // ===== 1) Create/Update TestCase =====
          let testCase;
          let testCaseAction = "created";

          if (testCaseIdInput) {
            const existing = await tx.testCase.findUnique({ where: { id: testCaseIdInput } });
            if (existing) {
              if (scenarioId) {
                const sc = await tx.scenario.findUnique({ where: { id: scenarioId } });
                if (!sc) throw new Error("Scenario not found");
              }
              if (userId) {
                const user = await tx.user.findUnique({ where: { id: userId } });
                if (!user) throw new Error("User not found");
              }

              testCase = await tx.testCase.update({
                where: { id: testCaseIdInput },
                data: {
                  ...(name !== undefined ? { name } : {}),
                  ...(userId !== undefined ? { userId } : {}),
                  ...(scenarioId !== undefined ? { scenarioId } : {}),
                  ...(workflowId !== undefined ? { workflowId } : {}),
                },
              });
              testCaseAction = "updated";
              await Log.info("TestCase updated", { testCaseId: testCase.id });
            } else {
              if (!workflowId) throw new Error("Missing workflowId for creating new TestCase with given id");
              const wf = await tx.workflow.findUnique({ where: { id: workflowId } });
              if (!wf) throw new Error("Workflow not found");
              if (scenarioId) {
                const sc = await tx.scenario.findUnique({ where: { id: scenarioId } });
                if (!sc) throw new Error("Scenario not found");
              }
              if (userId) {
                const user = await tx.user.findUnique({ where: { id: userId } });
                if (!user) throw new Error("User not found");
              }

              testCase = await tx.testCase.create({
                data: {
                  id: testCaseIdInput,
                  name: name ?? null,
                  workflowId,
                  scenarioId: scenarioId ?? null,
                  userId: userId ?? null
                },
              });
              testCaseAction = "created";
              await Log.info("TestCase created (with custom id)", { testCaseId: testCase.id, workflowId, scenarioId, userId });
            }
          } else {
            if (!workflowId) throw new Error("Missing workflowId");
            const wf = await tx.workflow.findUnique({ where: { id: workflowId } });
            if (!wf) throw new Error("Workflow not found");
            if (scenarioId) {
              const sc = await tx.scenario.findUnique({ where: { id: scenarioId } });
              if (!sc) throw new Error("Scenario not found");
            }
            if (userId) {
              const user = await tx.user.findUnique({ where: { id: userId } });
              if (!user) throw new Error("User not found");
            }

            testCase = await tx.testCase.create({
              data: {
                name: name ?? null,
                workflowId,
                scenarioId: scenarioId ?? null,
                userId: userId ?? null
              },
            });
            testCaseAction = "created";
            await Log.info("TestCase created", { testCaseId: testCase.id, workflowId, scenarioId, userId });
          }

          const effectiveWorkflowId = testCase.workflowId;

          // ===== 2) Create/Update TestCaseNode nếu có nodes =====
          const nodeActions = [];
          if (Array.isArray(nodes) && nodes.length > 0) {
            const nodeIds = nodes.map(n => n.nodeId);

            const configs = await tx.configurationData.findMany({
              where: { workflowNode: { workflowId: effectiveWorkflowId, nodeId: { in: nodeIds } } },
              select: { formatData: true, updatedAt: true, workflowNode: { select: { nodeId: true } } },
              orderBy: { updatedAt: "desc" },
            });

            const latestFmtByNodeId = new Map();
            for (const c of configs) {
              const nid = c.workflowNode.nodeId;
              if (!latestFmtByNodeId.has(nid) && c.formatData) latestFmtByNodeId.set(nid, c.formatData);
            }

            for (const node of nodes) {
              const rawSteps = JSON.parse(JSON.stringify(node.steps || []));
              const expectationArr = [];
              rawSteps.forEach(step => {
                if (Array.isArray(step.inputParam) && "expectedResponse" in step) {
                  if (Array.isArray(step.expectedResponse)) expectationArr.push(...step.expectedResponse);
                  else expectationArr.push(step.expectedResponse);
                  delete step.expectedResponse;
                }
              });

              const formatParam = normalizeStepsV2(rawSteps);

              const wfn = await tx.workflowNode.findFirst({
                where: { workflowId: effectiveWorkflowId, nodeId: node.nodeId },
                select: { id: true, nodeId: true },
              });
              if (!wfn) throw new Error(`WorkflowNode not found for nodeId=${node.nodeId}`);

              const existingNode = await tx.testCaseNode.findUnique({
                where: { testCaseId_workflowNodeId: { testCaseId: testCase.id, workflowNodeId: wfn.id } },
                select: { id: true },
              });

              let saved, action;
              if (existingNode) {
                saved = await tx.testCaseNode.update({
                  where: { id: existingNode.id },
                  data: {
                    inputParam: rawSteps,
                    formatParam,
                    expectation: expectationArr,
                    name: node.name ?? null,
                  },
                });
                action = "updated";
              } else {
                saved = await tx.testCaseNode.create({
                  data: {
                    testCaseId: testCase.id,
                    workflowNodeId: wfn.id,
                    inputParam: rawSteps,
                    formatParam,
                    expectation: expectationArr,
                    name: node.name ?? null,
                  },
                });
                action = "created";
              }

              nodeActions.push({
                id: saved.id,
                workflowNodeId: wfn.id,
                nodeId: wfn.nodeId,
                action,
              });
            }
          } else {
            await Log.info("No nodes provided — only created/updated TestCase", { testCaseId: testCase.id });
          }

          // ===== 3) Trả về kèm action =====
          const full = await tx.testCase.findUnique({
            where: { id: testCase.id },
            include: { testCaseNodes: true },
          });

          const actionByNodeId = new Map(nodeActions.map(n => [n.id, n.action]));

          return {
            id: full.id,
            name: full.name,
            workflowId: full.workflowId,
            scenarioId: full.scenarioId,
            action: testCaseAction,
            testCaseNodes: full.testCaseNodes.map(n => ({
              id: n.id,
              workflowNodeId: n.workflowNodeId,
              inputParam: n.inputParam,
              expectation: n.expectation,
              result: n.result,
              name: n.name,
              action: actionByNodeId.get(n.id) || "unchanged",
            })),
            hasNodes: Array.isArray(nodes) && nodes.length > 0
          };
        });

        result.push(data);

        const createdNodesCount = data.testCaseNodes.filter(n => n.action === "created").length;
        const updatedNodesCount = data.testCaseNodes.filter(n => n.action === "updated").length;

        if (data.action === "created") totalCreatedCases += 1;
        if (data.action === "updated") totalUpdatedCases += 1;
        totalCreatedNodes += createdNodesCount;
        totalUpdatedNodes += updatedNodesCount;

        await Log.info("TestCaseWithNodes processed", {
          testCaseId: data.id,
          action: data.action,
          nodes: data.testCaseNodes.length,
          createdNodes: createdNodesCount,
          updatedNodes: updatedNodesCount,
        });
      }

      let message;
      if (result.length === 1) {
        const one = result[0];
        const c = one.testCaseNodes.filter(n => n.action === "created").length;
        const u = one.testCaseNodes.filter(n => n.action === "updated").length;
        if (!one.hasNodes) {
          message = one.action === "created" ? "Created TestCase only." : "Updated TestCase only.";
        } else if (one.action === "created") {
          message = `Created successfully (nodes: ${c} created, ${u} updated).`;
        } else if (one.action === "updated") {
          message = `Updated successfully (nodes: ${c} created, ${u} updated).`;
        } else {
          message = `Processed successfully (nodes: ${c} created, ${u} updated).`;
        }
      } else {
        message = `Upsert completed: ${totalCreatedCases} created, ${totalUpdatedCases} updated; node changes: ${totalCreatedNodes} created, ${totalUpdatedNodes} updated.`;
      }

      return {
        status: 200,
        success: true,
        message,
        data: result,
      };
    } catch (error) {
      await Log.error("createTestCaseWithNodes failed", { error: error.message });
      return {
        status: 500,
        success: false,
        message: "Failed to process test cases: " + error.message,
      };
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

  // services/testCaseService.js
  updateTestCase: async ({ id, name, userId, nodes }) => {
    try {
      const existing = await prisma.testCase.findUnique({
        where: { id },
        select: { id: true, name: true, workflowId: true, scenarioId: true, userId: true }
      });
      if (!existing) {
        return { status: 404, success: false, message: "TestCase not found" };
      }

      let testCaseAction = "unchanged";
      let createdNodes = 0, updatedNodes = 0, unchangedNodes = 0;

      const isEqual = (a, b) =>
        JSON.stringify(a) === JSON.stringify(b);

      const data = await prisma.$transaction(async (tx) => {
        // 🔹 Validate userId mới nếu có truyền
        if (userId) {
          const user = await tx.user.findUnique({ where: { id: userId } });
          if (!user) throw new Error("User not found");
        }

        // 1) Update name hoặc userId nếu khác
        if (
          (name !== undefined && name !== existing.name) ||
          (userId !== undefined && userId !== existing.userId)
        ) {
          await tx.testCase.update({
            where: { id },
            data: {
              ...(name !== undefined ? { name } : {}),
              ...(userId !== undefined ? { userId } : {})
            }
          });
          testCaseAction = "updated";
          await Log.info("TestCase updated", {
            testCaseId: id,
            from: { name: existing.name, userId: existing.userId },
            to: { name, userId }
          });
        }

        const effectiveWorkflowId = existing.workflowId;
        const nodeActions = [];

        // 2) Xử lý nodes (giữ nguyên logic cũ)
        if (Array.isArray(nodes) && nodes.length > 0) {
          const nodeIds = nodes.map(n => n.nodeId).filter(Boolean);

          const wfnList = await tx.workflowNode.findMany({
            where: { workflowId: effectiveWorkflowId, nodeId: { in: nodeIds } },
            select: { id: true, nodeId: true }
          });
          const wfnByNodeId = new Map(wfnList.map(w => [w.nodeId, w]));

          const missing = nodeIds.filter(nid => !wfnByNodeId.has(nid));
          if (missing.length) throw new Error(`WorkflowNode not found for nodeId(s): ${missing.join(", ")}`);

          const existingNodes = await tx.testCaseNode.findMany({
            where: { testCaseId: id, workflowNodeId: { in: wfnList.map(w => w.id) } },
            select: { id: true, workflowNodeId: true, inputParam: true, formatParam: true, expectation: true, name: true }
          });
          const existingByWfnId = new Map(existingNodes.map(r => [r.workflowNodeId, r]));

          for (const node of nodes) {
            const wfn = wfnByNodeId.get(node.nodeId);

            const rawSteps = Array.isArray(node.steps)
              ? JSON.parse(JSON.stringify(node.steps))
              : [];

            const expectationArr = [];
            rawSteps.forEach(step => {
              if (Array.isArray(step?.inputParam) && "expectedResponse" in step) {
                if (Array.isArray(step.expectedResponse)) expectationArr.push(...step.expectedResponse);
                else expectationArr.push(step.expectedResponse);
                delete step.expectedResponse;
              }
            });

            const formatParam = normalizeStepsV2(rawSteps);

            const existingNode = existingByWfnId.get(wfn.id);
            if (existingNode) {
              const changed =
                !isEqual(existingNode.inputParam, rawSteps) ||
                !isEqual(existingNode.formatParam, formatParam) ||
                !isEqual(existingNode.expectation, expectationArr) ||
                (existingNode.name ?? null) !== (node.name ?? null);

              if (changed) {
                const saved = await tx.testCaseNode.update({
                  where: { id: existingNode.id },
                  data: {
                    inputParam: rawSteps,
                    formatParam,
                    expectation: expectationArr,
                    name: node.name ?? null
                  }
                });
                nodeActions.push({ id: saved.id, nodeId: node.nodeId, action: "updated" });
                updatedNodes++;
              } else {
                nodeActions.push({ id: existingNode.id, nodeId: node.nodeId, action: "unchanged" });
                unchangedNodes++;
              }
            } else {
              const saved = await tx.testCaseNode.create({
                data: {
                  testCaseId: id,
                  workflowNodeId: wfn.id,
                  inputParam: rawSteps,
                  formatParam,
                  expectation: expectationArr,
                  name: node.name ?? null
                }
              });
              nodeActions.push({ id: saved.id, nodeId: node.nodeId, action: "created" });
              createdNodes++;
            }
          }
        }

        const full = await tx.testCase.findUnique({
          where: { id },
          include: { testCaseNodes: true, user: { select: { id: true, username: true } } } // 🔹 include user
        });

        return {
          id: full.id,
          name: full.name,
          workflowId: full.workflowId,
          scenarioId: full.scenarioId,
          user: full.user,
          action: testCaseAction,
          testCaseNodes: full.testCaseNodes
            .map(n => ({
              id: n.id,
              workflowNodeId: n.workflowNodeId,
              inputParam: n.inputParam,
              expectation: n.expectation,
              result: n.result,
              name: n.name,
              action: nodeActions.find(a => a.id === n.id)?.action
            }))
            .filter(n => n.action && n.action !== "unchanged")
        };
      });

      return {
        status: 200,
        success: true,
        message: `${testCaseAction === "updated" ? "Updated" : "No change"} | Nodes: ${createdNodes} created, ${updatedNodes} updated, ${unchangedNodes} unchanged`,
        data
      };
    } catch (err) {
      await Log.error("updateTestCase failed", { testCaseId: id, error: err.message });
      return { status: 500, success: false, message: "Failed to update TestCase: " + err.message };
    }
  },

  deleteTestCase: async ({ id }) => {
    try {
      const existing = await prisma.testCase.findUnique({ where: { id } });
      if (!existing) {
        await Log.warn("TestCase not found for delete", { id });
        return {
          status: 404,
          success: false,
          message: "TestCase not found"
        };
      }

      await prisma.testCase.delete({ where: { id } });
      await Log.info("TestCase deleted", { id });
      return {
        status: 200,
        success: true,
        message: "TestCase deleted successfully",
        data: null
      };
    } catch (error) {
      await Log.error("Failed to delete TestCase", { id, error: error.message });
      throw new Error("Failed to delete test case: " + error.message);
    }
  }
};

export default testCaseService;
