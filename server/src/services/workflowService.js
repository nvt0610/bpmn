// services/workflowService.js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

import axios from "axios";
import xml2json from "xml2json";
import n8nService from "./n8nService.js";
import { Log } from "../helpers/logReceive.js";
import { XMLParser } from "fast-xml-parser";
import { getPaginationParams } from "../helpers/pagination.js";

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
});

async function createWorkflowNodesFromXml(workflowId, xmlContent) {
    if (!workflowId || !xmlContent) return { created: 0, updated: 0 };

    const localParser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        allowBooleanAttributes: true,
        parseTagValue: false
    });

    const xmlObj = localParser.parse(xmlContent);
    if (!xmlObj) return { created: 0, updated: 0 };

    const skipTypes = [
        "bpmn:definitions", "bpmn:process",
        "bpmn:sequenceFlow", "bpmn:messageFlow", "bpmn:association",
        "bpmn:laneSet", "bpmn:lane", "bpmn:participant", "bpmn:collaboration",
        "bpmn:textAnnotation", "bpmn:group", "bpmn:dataObject", "bpmn:dataObjectReference", "bpmn:dataStoreReference",
        "bpmn:timerEventDefinition", "bpmn:signalEventDefinition", "bpmn:messageEventDefinition",
        "bpmn:conditionalEventDefinition", "bpmn:errorEventDefinition", "bpmn:escalationEventDefinition",
        "bpmn:compensateEventDefinition", "bpmn:terminateEventDefinition", "bpmn:linkEventDefinition",
        "bpmn:dataInput", "bpmn:dataOutput", "bpmn:inputOutputSpecification"
    ];

    const seen = new Set();
    const nodes = [];

    function collectNodes(obj) {
        if (Array.isArray(obj)) return obj.forEach(collectNodes);
        if (obj && typeof obj === "object") {
            for (const [key, value] of Object.entries(obj)) {
                if (key.startsWith("bpmn:") && !skipTypes.includes(key)) {
                    const pushNode = (v) => {
                        if (v && v["@_id"] && !seen.has(v["@_id"])) {
                            seen.add(v["@_id"]);
                            nodes.push({ nodeId: v["@_id"], name: v["@_name"]?.trim() || undefined });
                        }
                    };
                    Array.isArray(value) ? value.forEach(pushNode) : pushNode(value);
                }
                collectNodes(value);
            }
        }
    }
    collectNodes(xmlObj);

    let created = 0, updated = 0;
    for (const { nodeId, name } of nodes) {
        const existing = await prisma.workflowNode.findUnique({
            where: { workflowId_nodeId: { workflowId, nodeId } },
        });

        if (!existing) {
            await prisma.workflowNode.create({ data: { workflowId, nodeId, ...(name && { name }) } });
            created++;
        } else if (name && !existing.name) {
            await prisma.workflowNode.update({
                where: { workflowId_nodeId: { workflowId, nodeId } },
                data: { name },
            });
            updated++;
        }
    }
    return { created, updated };
}

const workflowService = {
    getQcConfig: async ({ workflowId }) => {
        if (!workflowId) {
            await Log.warn("Missing workflowId in query");
            return { status: 400, message: "Missing workflowId" };
        }

        try {
            const wf = await prisma.workflow.findUnique({
                where: { id: workflowId },
                select: { id: true, name: true }
            });

            if (!wf) {
                const available = await prisma.workflow.findMany({ select: { id: true, name: true } });
                return {
                    status: 404,
                    message: "Workflow not found",
                    receivedWorkflowId: workflowId,
                    availableWorkflows: available
                };
            }

            const scenarios = await prisma.scenario.findMany({
                where: { testCases: { some: { workflowId } } },
                select: {
                    id: true, name: true, createdAt: true, updatedAt: true,
                    testCases: {
                        select: {
                            id: true, name: true, createdAt: true, updatedAt: true,
                            testCaseNodes: {
                                select: {
                                    id: true, inputParam: true, expectation: true, workflowNodeId: true,
                                    workflowNode: { select: { nodeId: true, name: true } }
                                },
                                orderBy: { createdAt: "asc" }
                            }
                        },
                        orderBy: { createdAt: "desc" }
                    }
                },
                orderBy: { createdAt: "desc" },
            });

            await Log.info("Listed scenarios/testcases by workflowId", {
                workflowId, workflowName: wf.name, totalScenarios: scenarios.length
            });

            return {
                status: 200,
                message: "QC Config fetched by workflowId",
                workflowId: wf.id,
                workflowName: wf.name,
                scenarios: scenarios.map(s => ({
                    id: s.id,
                    name: s.name,
                    createdAt: s.createdAt,
                    updatedAt: s.updatedAt,
                    testCases: s.testCases.map(tc => ({
                        id: tc.id,
                        name: tc.name,
                        createdAt: tc.createdAt,
                        updatedAt: tc.updatedAt,
                        testCaseNodes: tc.testCaseNodes.map(n => ({
                            id: n.id,
                            inputParam: n.inputParam,
                            expectation: n.expectation,
                            workflowNodeId: n.workflowNodeId,
                            nodeId: n.workflowNode?.nodeId || null,
                            workflowNodeName: n.workflowNode?.name || null
                        }))
                    }))
                }))
            };
        } catch (error) {
            await Log.error("getQcConfig failed", { workflowId, error: error.message });
            return { status: 500, message: "Failed to fetch QC config: " + error.message };
        }
    },

    getConfigData: async ({ workflowId, nodeId, userId }) => {
        if (!workflowId) return { status: 400, message: "Missing workflowId" };

        try {
            const where = {
                ...(userId && { userId }),
                workflowNode: { workflowId, ...(nodeId && { nodeId }) },
            };

            const records = await prisma.configurationData.findMany({
                where,
                select: {
                    userId: true, data: true, createdAt: true, updatedAt: true, workflowNodeId: true,
                    workflowNode: { select: { nodeId: true, name: true } },
                    user: { select: { username: true } }
                },
                orderBy: { updatedAt: "desc" }
            });

            if (!records.length) {
                await Log.warn("ConfigData empty by workflow", { workflowId, nodeId, userId });
                return { status: 404, message: "No configuration data found" };
            }

            await Log.info("ConfigData fetched", { workflowId, nodeId, userId, count: records.length });

            return {
                status: 200,
                message: "Configuration data fetched successfully",
                workflowNodes: records.map(r => ({
                    workflowNodeId: r.workflowNodeId,
                    nodeId: r.workflowNode?.nodeId || null,
                    workflowNodeName: r.workflowNode?.name || null,
                    userId: r.userId,
                    userName: r.user?.username || null,
                    createdAt: r.createdAt,
                    updatedAt: r.updatedAt,
                    data: r.data || null
                }))
            };
        } catch (error) {
            await Log.error("getConfigData failed", { workflowId, nodeId, userId, error: error.message });
            return { status: 500, message: "Failed to fetch configuration data: " + error.message };
        }
    },

    getTestBatch: async ({ workflowId, page = 1, pageSize = 10 }) => {
        if (!workflowId) return { status: 400, message: "Missing workflowId" };

        try {
            const { skip, take, page: curPage, pageSize: curPageSize } = getPaginationParams({ page, pageSize });

            const [batches, total] = await Promise.all([
                prisma.testBatch.findMany({
                    where: { scenarios: { some: { testCases: { some: { workflowId } } } } },
                    select: {
                        id: true, createdAt: true, updatedAt: true,
                        scenarios: {
                            select: {
                                id: true, name: true,
                                testCases: { where: { workflowId }, select: { id: true, name: true, workflowId: true } },
                            },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                    skip, take
                }),
                prisma.testBatch.count({
                    where: { scenarios: { some: { testCases: { some: { workflowId } } } } }
                })
            ]);

            if (!batches.length) {
                return {
                    status: 200,
                    message: "No TestBatch found for given workflowId",
                    page: curPage, pageSize: curPageSize, total: 0,
                    data: [],
                };
            }

            return {
                status: 200,
                message: "TestBatches fetched by workflowId successfully",
                page: curPage, pageSize: curPageSize, total,
                data: batches,
            };
        } catch (error) {
            return { status: 500, message: "Failed to fetch test batches by workflowId", error: error.message };
        }
    },

    getTestCases: async ({ workflowId }) => {
        if (!workflowId) {
            await Log.warn("Missing workflowId when fetching test cases");
            return { status: 400, message: "Missing workflowId" };
        }

        try {
            const testCases = await prisma.testCase.findMany({
                where: { workflowId },
                select: { id: true, name: true },
                orderBy: { createdAt: "desc" }
            });

            await Log.info("Fetched test cases", { workflowId, count: testCases.length });

            return {
                status: 200,
                message: "Fetched test cases successfully",
                data: {
                    workflowId,
                    totalTestCases: testCases.length,
                    testCases: testCases.map(tc => ({ id: tc.id, name: tc.name || null }))
                }
            };
        } catch (error) {
            await Log.error("Failed to fetch test cases", { workflowId, error: error.message });
            return { status: 500, message: "Failed to fetch test cases" };
        }
    },

    // ===== TREE THEO WORKFLOW =====
    getResult: async ({ workflowId, page = 1, pageSize = 10 }) => {
        if (!workflowId) return { status: 400, message: "Missing workflowId" };

        try {
            const { skip, take, page: curPage, pageSize: curPageSize } = getPaginationParams({ page, pageSize });

            const batches = await prisma.testBatch.findMany({
                where: { scenarios: { some: { testCases: { some: { workflowId } } } } },
                select: { id: true, createdAt: true, updatedAt: true },
                orderBy: { createdAt: "desc" },
                skip,
                take
            });

            if (!batches.length) {
                return {
                    status: 200,
                    message: "OK",
                    data: { workflowId, page: curPage, pageSize: curPageSize, totalBatch: 0, batches: [] }
                };
            }

            const batchIds = batches.map(b => b.id);

            const scenarios = await prisma.scenario.findMany({
                where: { testBatchId: { in: batchIds }, testCases: { some: { workflowId } } },
                select: { id: true, name: true, testBatchId: true, createdAt: true, updatedAt: true }
            });
            const scenarioIds = scenarios.map(s => s.id);

            const testCases = scenarioIds.length
                ? await prisma.testCase.findMany({
                    where: { workflowId, scenarioId: { in: scenarioIds } },
                    select: { id: true, name: true, scenarioId: true, createdAt: true, updatedAt: true }
                })
                : [];
            const testCaseIds = testCases.map(tc => tc.id);

            const nodes = testCaseIds.length
                ? await prisma.testCaseNode.findMany({
                    where: { testCaseId: { in: testCaseIds } },
                    select: {
                        id: true,
                        testCaseId: true,
                        name: true,
                        results: { select: { result: true, createdAt: true, updatedAt: true } },
                        resultReceiveAt: true,
                        createdAt: true,
                        updatedAt: true,
                        workflowNodeId: true,
                        workflowNode: { select: { nodeId: true, name: true } }
                    },
                    orderBy: { createdAt: "asc" }
                })
                : [];

            const testCaseToNodes = nodes.reduce((m, n) => {
                const arr = m.get(n.testCaseId) || [];
                arr.push({
                    id: n.id,
                    workflowNodeId: n.workflowNodeId,
                    nodeId: n.workflowNode?.nodeId || null,
                    nodeName: n.workflowNode?.name || null,
                    name: n.name || null,
                    results: n.results.map(r => ({
                        result: r.result,
                        createdAt: r.createdAt,
                        updatedAt: r.updatedAt
                    })),
                    resultReceiveAt: n.resultReceiveAt,
                    createdAt: n.createdAt,
                    updatedAt: n.updatedAt
                });
                m.set(n.testCaseId, arr);
                return m;
            }, new Map());

            const scenarioToTestCases = testCases.reduce((m, tc) => {
                const arr = m.get(tc.scenarioId) || [];
                arr.push({
                    id: tc.id,
                    name: tc.name || null,
                    createdAt: tc.createdAt,
                    updatedAt: tc.updatedAt,
                    nodes: testCaseToNodes.get(tc.id) || []
                });
                m.set(tc.scenarioId, arr);
                return m;
            }, new Map());

            const batchToScenarios = scenarios.reduce((m, sc) => {
                const arr = m.get(sc.testBatchId) || [];
                arr.push({
                    id: sc.id,
                    name: sc.name,
                    createdAt: sc.createdAt,
                    updatedAt: sc.updatedAt,
                    testCases: scenarioToTestCases.get(sc.id) || []
                });
                m.set(sc.testBatchId, arr);
                return m;
            }, new Map());

            const tree = batches.map(b => ({
                id: b.id,
                createdAt: b.createdAt,
                updatedAt: b.updatedAt,
                scenarios: (batchToScenarios.get(b.id) || []).sort(
                    (a, c) => new Date(c.createdAt) - new Date(a.createdAt)
                )
            }));

            return {
                status: 200,
                message: "Fetched workflow tree successfully",
                data: { workflowId, page: curPage, pageSize: curPageSize, totalBatch: tree.length, batches: tree }
            };
        } catch (error) {
            return { status: 500, message: "Failed to fetch workflow result tree", error: error.message };
        }
    },

    getAllworkflows: async ({ page = 1, pageSize = 10 }) => {
        const { skip, take, page: curPage, pageSize: curPageSize } = getPaginationParams({ page, pageSize });

        try {
            const [items, total] = await Promise.all([
                prisma.workflow.findMany({
                    skip,
                    take,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        name: true,
                        createdAt: true,
                        updatedAt: true,
                        project: { select: { id: true, name: true } },
                        status: true,
                        user: { select: { id: true, username: true } },
                        updatedBy: { select: { id: true, username: true } }
                    }
                }),
                prisma.workflow.count()
            ]);

            return {
                status: 200,
                message: "Fetched workflow list successfully",
                total,
                page: curPage,
                pageSize: curPageSize,
                items: items.map(wf => ({
                    id: wf.id,
                    name: wf.name,
                    createdAt: wf.createdAt,
                    updatedAt: wf.updatedAt,
                    status: wf.status,
                    projectId: wf.project?.id || "",
                    projectName: wf.project?.name || "",
                    createdById: wf.user.id,
                    createdBy: wf.user.username,
                    updatedById: wf.updatedBy?.id || "",
                    updatedBy: wf.updatedBy?.username || ""
                }))
            };
        } catch (error) {
            return { status: 500, message: "Failed to get workflow list", error: error.message };
        }
    },

    runWorkflowById: async ({ workflowId, testBatchId }) => {
        try {
            const token = await n8nService.getToken();
            if (!token?.success) {
                return { status: 500, message: "Failed to get N8N token: " + (token?.message || "Unknown error") };
            }

            const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
            if (!workflow) return { status: 404, message: "Workflow not found" };

            const testBatch = await prisma.testBatch.findUnique({ where: { id: testBatchId } });
            if (!testBatch) return { status: 404, message: "Test batch not found" };

            const url = `${n8nService.N8N_ENDPOINT}/test-automation/api/v1/workflows/${workflowId}/run`;
            const response = await axios.post(
                url,
                { testBatchId },
                { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.token || token}` } }
            );

            return { status: 200, message: "Run workflow request sent to n8n successfully", data: response.data };
        } catch (error) {
            return { status: 500, message: "Failed to run workflow: " + (error.response?.data?.error || error.message) };
        }
    },

    getWorkflowDetail: async ({ id }) => {
        if (!id) return { status: 400, message: "Missing workflow id" };

        try {
            const workflow = await prisma.workflow.findUnique({
                where: { id },
                select: {
                    id: true,
                    name: true,
                    createdAt: true,
                    updatedAt: true,
                    projectId: true,
                    project: { select: { name: true } },
                    description: true,
                    status: true, // đây là business status enum
                    userId: true,
                    user: { select: { username: true } },
                    updatedBy: { select: { username: true } },
                    updatedId: true,
                    xmlContent: true
                }
            });

            if (!workflow) return { status: 404, message: "Workflow not found" };

            const { user, updatedBy, project, status: workflowStatus, ...rest } = workflow;
            return {
                status: 200, // HTTP status code
                message: "Fetched workflow detail successfully",
                workflowStatus, // business status
                ...rest,
                projectName: project?.name || null,
                createdBy: user?.username || null,
                updatedBy: updatedBy?.username || null
            };
        } catch (error) {
            return { status: 500, message: error.message };
        }
    },

    createWorkflow: async (payload) => {
        const { name, projectId, status, userId, xmlContent, description, jsonContent } = payload;

        const finalXmlContent = xmlContent || null;
        let finalJsonContent = jsonContent;
        const updatedId = userId;

        if (!finalJsonContent && finalXmlContent) {
            try {
                finalJsonContent = parser.parse(finalXmlContent);
            } catch {
                return { status: 400, message: "Invalid XML content" };
            }
        }

        try {
            const [existingWorkflow, existingUser] = await Promise.all([
                prisma.workflow.findFirst({ where: { name } }),
                prisma.user.findUnique({ where: { id: userId } }),
            ]);

            if (existingWorkflow) return { status: 409, message: "Workflow name already exists" };
            if (!existingUser) return { status: 404, message: "User not found" };

            if (projectId) {
                const project = await prisma.project.findUnique({ where: { id: projectId } });
                if (!project) return { status: 404, message: "Project not found" };
            }

            const workflow = await prisma.workflow.create({
                data: {
                    name,
                    userId,
                    updatedId,
                    description,
                    ...(projectId && { projectId }),
                    ...(status && { status }),
                    ...(finalXmlContent && { xmlContent: finalXmlContent }),
                    ...(finalJsonContent && { jsonContent: finalJsonContent }),
                }
            });

            const nodeStats = await createWorkflowNodesFromXml(workflow.id, finalXmlContent);

            const newWorkflow = await prisma.workflow.findUnique({
                where: { id: workflow.id },
                select: {
                    id: true, name: true, description: true,
                    project: { select: { name: true } },
                    workflowNode: true
                }
            });

            await Log.info("Workflow created", { workflowId: workflow.id, createdNodes: nodeStats.created });

            return {
                status: 201,
                message: `Workflow created successfully (nodes: ${nodeStats.created} created, ${nodeStats.updated} updated)`,
                data: { ...newWorkflow, projectName: newWorkflow.project?.name || null }
            };
        } catch (error) {
            await Log.error("Failed to create workflow", { error: error.message });
            return { status: 500, message: "Failed to create workflow" };
        }
    },

    updateWorkflow: async (payload) => {
        const { id, updatedBy, userId, description, ...newData } = payload;
        const updaterId = updatedBy || userId || null;

        try {
            const result = await prisma.$transaction(async (tx) => {
                const existing = await tx.workflow.findUnique({ where: { id } });
                if (!existing) return { status: 404, message: "Workflow not found" };

                const dataToUpdate = Object.fromEntries(
                    Object.entries(newData).filter(([k, v]) => v !== undefined && existing[k] !== v)
                );

                if (description !== undefined && existing.description !== description) {
                    dataToUpdate.description = description;
                }

                if (updaterId) dataToUpdate.updatedId = updaterId;

                if (dataToUpdate.name) {
                    const dup = await tx.workflow.findFirst({ where: { name: dataToUpdate.name, NOT: { id } } });
                    if (dup) return { status: 409, message: "Another workflow with the same name already exists" };
                }

                let nodeStats;
                if (dataToUpdate.xmlContent) {
                    try {
                        // Parse XML thành object trước
                        const jsonString = xml2json.toJson(dataToUpdate.xmlContent); // luôn trả string
                        const parsedJson = JSON.parse(jsonString); // chuyển string -> object JS
                        dataToUpdate.jsonContent = parsedJson; // Prisma json field nhận object
                    } catch (err) {
                        return { status: 400, message: "Invalid XML content" };
                    }

                    nodeStats = await createWorkflowNodesFromXml(id, dataToUpdate.xmlContent);
                }

                const updated = await tx.workflow.update({
                    where: { id },
                    data: dataToUpdate,
                    include: {
                        updatedBy: { select: { id: true, username: true } },
                        workflowNode: true
                    }
                });

                await Log.info("Updated workflow", {
                    workflowId: id,
                    updatedBy: updaterId,
                    updatedFields: Object.keys(dataToUpdate),
                    changes: dataToUpdate,
                });

                return {
                    status: 200,
                    message: `Workflow updated successfully (nodes: ${nodeStats?.created || 0} created, ${nodeStats?.updated || 0} updated)`,
                    createdNodes: nodeStats?.created || 0,
                    updatedNodes: nodeStats?.updated || 0,
                    data: updated
                };
            });

            return result;
        } catch (error) {
            return { status: 500, message: "Failed to update workflow: " + error.message };
        }
    },

    deleteWorkflow: async ({ id }) => {
        try {
            const existing = await prisma.workflow.findUnique({ where: { id } });
            if (!existing) return { status: 404, message: "Workflow not found" };

            const nodes = await prisma.workflowNode.findMany({
                where: { workflowId: id },
                select: { id: true },
            });
            const nodeIds = nodes.map((n) => n.id);

            await prisma.configurationData.deleteMany({ where: { workflowNodeId: { in: nodeIds } } });
            await prisma.workflowNode.deleteMany({ where: { workflowId: id } });
            await prisma.workflow.delete({ where: { id } });

            return { status: 200, message: "Workflow deleted successfully" };
        } catch (error) {
            return { status: 500, message: "Failed to delete workflow: " + error.message };
        }
    },
};

export default workflowService;
