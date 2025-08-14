import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import xml2json from "xml2json";
import { v4 as uuidv4 } from "uuid";
import n8nService from "./n8nService.js";
import { Log } from "../helpers/logReceive.js"; // ghi log vào DB, KHÔNG đổi response
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
    ignoreAttributes: false, // để giữ lại @id, @name, ...
    attributeNamePrefix: "@_", // prefix cho attribute
});

function generateBpmnXmlWithUuid(workflowName) {
    const uuid = uuidv4().replace(/-/g, '');
    const processId = `Process_${uuid}`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:modeler="http://camunda.org/schema/modeler/1.0" id="Definitions_${uuid}" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Camunda Modeler" exporterVersion="5.37.0" modeler:executionPlatform="Camunda Cloud" modeler:executionPlatformVersion="8.7.0">
  <bpmn:process id="${processId}" name="${workflowName}" isExecutable="true" />
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${processId}" />
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n || 0));

async function createWorkflowNodesFromXml(workflowId, xmlContent) {
    if (!workflowId || !xmlContent) return { created: 0, updated: 0 };

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        allowBooleanAttributes: true,
        parseTagValue: false
    });

    const xmlObj = parser.parse(xmlContent);
    if (!xmlObj) return { created: 0, updated: 0 };

    const skipTypes = [
        // Container / Root
        "bpmn:definitions", "bpmn:process",

        // Connecting objects
        "bpmn:sequenceFlow", "bpmn:messageFlow", "bpmn:association",
        // Swimlanes
        "bpmn:laneSet", "bpmn:lane", "bpmn:participant", "bpmn:collaboration",
        // Artifacts
        "bpmn:textAnnotation", "bpmn:group", "bpmn:dataObject", "bpmn:dataObjectReference", "bpmn:dataStoreReference",
        // Event Definitions
        "bpmn:timerEventDefinition", "bpmn:signalEventDefinition", "bpmn:messageEventDefinition",
        "bpmn:conditionalEventDefinition", "bpmn:errorEventDefinition", "bpmn:escalationEventDefinition",
        "bpmn:compensateEventDefinition", "bpmn:terminateEventDefinition", "bpmn:linkEventDefinition",
        // Data
        "bpmn:dataInput", "bpmn:dataOutput", "bpmn:inputOutputSpecification"
    ];

    const seen = new Set();
    const nodes = [];

    function collectNodes(obj) {
        if (Array.isArray(obj)) {
            obj.forEach(o => collectNodes(o));
        } else if (typeof obj === "object" && obj !== null) {
            for (const [key, value] of Object.entries(obj)) {
                if (key.startsWith("bpmn:") && !skipTypes.includes(key)) {
                    // value có thể là object hoặc array
                    if (Array.isArray(value)) {
                        value.forEach(v => {
                            if (v && v["@_id"] && !seen.has(v["@_id"])) {
                                seen.add(v["@_id"]);
                                nodes.push({
                                    nodeId: v["@_id"],
                                    name: v["@_name"]?.trim() || undefined
                                });
                            }
                        });
                    } else if (value && typeof value === "object" && value["@_id"]) {
                        if (!seen.has(value["@_id"])) {
                            seen.add(value["@_id"]);
                            nodes.push({
                                nodeId: value["@_id"],
                                name: value["@_name"]?.trim() || undefined
                            });
                        }
                    }
                }
                // đệ quy tiếp để không bỏ sót node con
                collectNodes(value);
            }
        }
    }

    collectNodes(xmlObj);

    let createdCount = 0;
    let updatedCount = 0;

    for (const { nodeId, name } of nodes) {
        const existing = await prisma.workflowNode.findUnique({
            where: { workflowId_nodeId: { workflowId, nodeId } },
        });

        if (!existing) {
            await prisma.workflowNode.create({
                data: { workflowId, nodeId, ...(name && { name }) },
            });
            createdCount++;
        } else if (name && !existing.name) {
            await prisma.workflowNode.update({
                where: { workflowId_nodeId: { workflowId, nodeId } },
                data: { name },
            });
            updatedCount++;
        }
    }

    return { created: createdCount, updated: updatedCount };
}

const workflowService = {

    getQcConfig: async ({ workflowId }) => {
        if (!workflowId) {
            await Log.warn("Missing workflowId in query");
            return { message: "Missing workflowId" };
        }

        try {
            const wf = await prisma.workflow.findUnique({
                where: { id: workflowId },
                select: { id: true, name: true }
            });
            if (!wf) {
                const available = await prisma.workflow.findMany({
                    select: { id: true, name: true }
                });
                return {
                    message: "Workflow not found",
                    receivedWorkflowId: workflowId,
                    availableWorkflows: available
                };
            }

            const scenarios = await prisma.scenario.findMany({
                where: {
                    testCases: {
                        some: { workflowId }
                    }
                },
                select: {
                    id: true,
                    name: true,
                    createdAt: true,
                    updatedAt: true,
                    testCases: {
                        select: {
                            id: true,
                            name: true,
                            createdAt: true,
                            updatedAt: true,
                            testCaseNodes: {
                                select: {
                                    id: true,
                                    inputParam: true,
                                    expectation: true,
                                    workflowNodeId: true,
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
            await Log.error("getQcConfig failed", {
                workflowId, error: error.message
            });
            return {
                message: "Failed to fetch QC config: " + error.message
            };
        }
    },

    getConfigData: async ({ workflowId, nodeId, userId }) => {
        if (!workflowId) {
            return { message: "Missing workflowId" };
        }
        try {
            const where = {
                ...(userId && { userId }),
                workflowNode: { workflowId, ...(nodeId && { nodeId }) },
            };

            const records = await prisma.configurationData.findMany({
                where,
                select: {
                    userId: true,
                    data: true,
                    createdAt: true,
                    updatedAt: true,
                    workflowNodeId: true,
                    workflowNode: { select: { nodeId: true, name: true } },
                    user: { select: { username: true } }
                },
                orderBy: { updatedAt: "desc" }
            });

            if (!records.length) {
                await Log.warn("ConfigData empty by workflow", { workflowId, nodeId, userId });
                return { message: "No configuration data found" };
            }

            await Log.info("ConfigData fetched", {
                workflowId, nodeId, userId, count: records.length
            });

            return {
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
            return { message: "Failed to fetch configuration data: " + error.message };
        }
    },


    getTestBatch: async ({ workflowId, page = 1, pageSize = 10 }) => {
        if (!workflowId) {
            return { message: "Missing workflowId" };
        }

        try {
            const take = clamp(pageSize, 1, 100);
            const skip = (clamp(page, 1, 1e9) - 1) * take;

            const [batches, total] = await Promise.all([
                prisma.testBatch.findMany({
                    where: {
                        scenarios: {
                            some: {
                                testCases: { some: { workflowId } },
                            },
                        },
                    },
                    select: {
                        id: true,
                        createdAt: true,
                        updatedAt: true,
                        scenarios: {
                            select: {
                                id: true,
                                name: true,
                                testCases: {
                                    where: { workflowId },
                                    select: { id: true, name: true, workflowId: true },
                                },
                            },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                    skip, take
                }),
                prisma.testBatch.count({
                    where: {
                        scenarios: { some: { testCases: { some: { workflowId } } } }
                    }
                })
            ]);

            if (!batches.length) {
                return {
                    message: "No TestBatch found for given workflowId",
                    page, pageSize, total: 0,
                    data: [],
                };
            }

            return {
                message: "TestBatches fetched by workflowId successfully",
                page, pageSize, total,
                data: batches,
            };
        } catch (error) {
            return {
                message: "Failed to fetch test batches by workflowId",
                error: error.message,
            };
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
                    testCases: testCases.map(tc => ({
                        id: tc.id,
                        name: tc.name || null
                    }))
                }
            };
        } catch (error) {
            await Log.error("Failed to fetch test cases", { workflowId, error: error.message });
            return { status: 500, message: "Failed to fetch test cases" };
        }
    },

    // ===== TREE THEO WORKFLOW =====
    getResult: async ({ workflowId, page = 1, pageSize = 10 }) => {
        if (!workflowId) {
            return { message: "Missing workflowId" };
        }
        const take = clamp(pageSize, 1, 100);
        const skip = clamp(page, 1, 1e9) - 1;

        const batches = await prisma.testBatch.findMany({
            where: {
                scenarios: { some: { testCases: { some: { workflowId } } } }
            },
            select: { id: true, createdAt: true, updatedAt: true },
            orderBy: { createdAt: "desc" },
            skip: skip * take,
            take
        });

        if (!batches.length) {
            return {
                message: "OK",
                data: { workflowId, page, pageSize, totalBatch: 0, batches: [] }
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
                    results: { // ✅ Quan hệ nhiều kết quả
                        select: {
                            result: true,
                            createdAt: true,
                            updatedAt: true
                        }
                    },
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
                result: n.result ?? null,
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
            message: "Fetched workflow tree successfully",
            data: {
                workflowId,
                page,
                pageSize,
                totalBatch: tree.length,
                batches: tree
            }
        };
    },

    getAllworkflows: async ({ page = 1, pageSize = 10 }) => {
        const pageNumber = parseInt(page);
        const pageSizeNumber = parseInt(pageSize);
        const skip = (pageNumber - 1) * pageSizeNumber;

        try {
            const [items, total] = await Promise.all([
                prisma.workflow.findMany({
                    skip,
                    take: pageSizeNumber, // ✅ phải là Int
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        name: true,
                        createdAt: true,
                        updatedAt: true,
                        project: {
                            select: { id: true, name: true }
                        },
                        status: true,
                        user: {
                            select: { id: true, username: true }
                        },
                        updatedBy: {
                            select: { id: true, username: true }
                        }
                    }
                }),
                prisma.workflow.count()
            ]);

            return {

                total,
                page: pageNumber,
                pageSize: pageSizeNumber,
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
                    updatedBy: wf.updatedBy?.username || "",
                }))

            };
        } catch (error) {
            return {
                message: "Failed to get workflow list",
                error: error.message
            };
        }
    },

    runWorkflowById: async ({ workflowId, testBatchId }) => {
        try {
            const token = await n8nService.getToken();
            if (!token.success) {
                return {
                    message: "Failed to get N8N token: " + token.message,
                };
            }
            const workflowId = await prisma.workflow.findUnique({
                where: { id }
            });
            if (!workflow) {
                return {
                    message: "Workflow not found",
                };
            }
            const testBatchId = await prisma.testBatch.findUnique({
                where: { id: testBatchId }
            });
            if (!testBatch) {
                return {
                    message: "Test batch not found",
                };
            }
            const response = await axios.post(
                `${N8nService.N8N_ENDPOINT}/test-automation/api/v1/workflows/${workflowId}/run`,
                { testBatchId }, // chỉ gửi testBatchId trong body
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                    },
                }
            );
            return {
                message: "Run workflow request sent to n8n successfully",
                data: response.data,
            };
        } catch (error) {
            throw new Error("Failed to run workflow: " + (error.response?.data?.error || error.message));
        }
    },

    getWorkflowDetail: async ({ id }) => {
        if (!id) {
            return {
                message: "Missing workflow id",
            };
        }

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
                    status: true,
                    userId: true,
                    user: { select: { username: true } },
                    updatedBy: { select: { username: true } },
                    updatedId: true,
                    xmlContent: true,
                }
            });

            if (!workflow) {
                return {
                    message: "Workflow not found"
                };
            }

            // Flatten
            const { user, updatedBy, project, ...rest } = workflow;
            return {
                ...rest,
                projectName: project?.name || null,
                createdBy: user?.username || null,
                updatedBy: updatedBy?.username || null
            };
        } catch (error) {
            throw error; // để controller hoặc middleware xử lý
        }
    },

    createWorkflow: async (payload) => {
        const {
            name,
            projectId,
            status,
            userId,
            xmlContent,
            description,
            jsonContent,
        } = payload;

        // Load file mặc định nếu không truyền xmlContent
        let finalXmlContent = xmlContent || generateBpmnXmlWithUuid(name);
        let finalJsonContent = jsonContent;
        let updatedId = userId;

        if (!finalJsonContent && finalXmlContent) {
            try {
                finalJsonContent = parser.parse(finalXmlContent);
            } catch (err) {
                return { status: 400, message: "Invalid XML content" };
            }
        }

        try {
            const [existingWorkflow, existingUser] = await Promise.all([
                prisma.workflow.findFirst({ where: { name } }),
                prisma.user.findUnique({ where: { id: userId } }),
            ]);

            const errors = [];
            if (existingWorkflow) return { status: 409, message: "Workflow name already exists" };
            if (!existingUser) return { status: 404, message: "User not found" };

            if (projectId) {
                const project = await prisma.project.findUnique({ where: { id: projectId } });
                if (!project) return { status: 404, message: "Project not found" };
            }

            // 1. Tạo workflow
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

            // 2. Tạo workflowNode từ XML
            const nodeStats = await createWorkflowNodesFromXml(workflow.id, finalXmlContent);

            // 3. Query lại ngay để trả kèm node

            const newWorkflow = await prisma.workflow.findUnique({
                where: { id: workflow.id },
                select: {
                    id: true, name: true, description: true,
                    project: { select: { name: true } },
                    workflowNode: true
                }
            });

            // Xoá project, chỉ giữ projectName
            await Log.info("Workflow created", { workflowId: workflow.id, createdNodes: nodeStats.created });

            return {
                status: 201,
                message: `Workflow created successfully (nodes: ${nodeStats.created} created, ${nodeStats.updated} updated)`,
                data: {
                    ...newWorkflow,
                    projectName: newWorkflow.project?.name || null
                }
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
            return await prisma.$transaction(async (tx) => {
                const existing = await tx.workflow.findUnique({ where: { id } });
                if (!existing) return { message: "Workflow not found" };

                const dataToUpdate = Object.fromEntries(
                    Object.entries(newData).filter(([k, v]) => v !== undefined && existing[k] !== v)
                );

                if (description !== undefined && existing.description !== description) {
                    dataToUpdate.description = description;
                }

                if (updaterId) dataToUpdate.updatedId = updaterId; // ← lưu người cập nhật

                if (dataToUpdate.name) {
                    const dup = await tx.workflow.findFirst({ where: { name: dataToUpdate.name, NOT: { id } } });
                    if (dup) return { message: "Another workflow with the same name already exists" };
                }

                if (dataToUpdate.xmlContent) {
                    try {
                        xml2json.toJson(dataToUpdate.xmlContent, { object: true }); // validate XML
                    } catch {
                        return { message: "Invalid XML content" };
                    }
                    // Cập nhật node mới và lấy số lượng thay đổi
                    var nodeStats = await createWorkflowNodesFromXml(id, dataToUpdate.xmlContent);
                }

                // Query lại ngay để trả kèm workflowNode
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
                    message: `Workflow updated successfully (nodes: ${nodeStats?.created || 0} created, ${nodeStats?.updated || 0} updated)`,
                    createdNodes: nodeStats?.created || 0,
                    updatedNodes: nodeStats?.updated || 0,
                    data: updated
                };
            });
        } catch (error) {
            throw new Error("Failed to update workflow: " + error.message);
        }
    },

    deleteWorkflow: async ({ id }) => {
        try {
            const existing = await prisma.workflow.findUnique({ where: { id } });
            if (!existing) {
                return {
                    message: "Workflow not found",
                };
            }

            // Lấy danh sách node liên quan
            const nodes = await prisma.workflowNode.findMany({
                where: { workflowId: id },
                select: { id: true },
            });

            const nodeIds = nodes.map((n) => n.id);

            // Xóa configurationData trước
            await prisma.configurationData.deleteMany({
                where: { workflowNodeId: { in: nodeIds } },
            });

            // Xóa workflowNode
            await prisma.workflowNode.deleteMany({
                where: { workflowId: id },
            });

            // Cuối cùng xóa testCase
            await prisma.workflow.delete({ where: { id } });

            return {
                message: "Workflow deleted successfully",
            };
        } catch (error) {
            throw new Error("Failed to delete workflow: " + error.message);
        }
    },
};

export default workflowService;
