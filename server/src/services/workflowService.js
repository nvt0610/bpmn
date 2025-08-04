import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import fs from "fs";
import path from "path";
import xml2json from "xml2json";
import testCaseNodeService from './workflowNodeService.js';

const workflowService = {
    getAllworkflows: async ({ page, pageSize } = {}) => {
        try {
            let options = {
                include: { user: true }
            };

            // Nếu có page và pageSize thì phân trang, ngược lại lấy all
            if (page && pageSize) {
                const p = parseInt(page);
                const ps = parseInt(pageSize);
                options.skip = (p - 1) * ps;
                options.take = ps;
            }

            const workflows = await prisma.workflow .findMany(options);
            return {
                status: 200,
                success: true,
                message: "Workflows fetched successfully",
                data: workflows,
            };
        } catch (error) {
            throw new Error("Failed to fetch workflows: " + error.message);
        }
    },

    getWorkflowById: async ({ id }) => {
        try {
            const workflow = await prisma.workflow.findUnique({
                where: { id },
                include: {
                    user: true,
                    workflowNode: {
                        include: {
                            configurationData: true, // nếu cần lấy cả dữ liệu từng node
                        },
                    },
                },
            });

            if (!workflow) {
                return {
                    status: 404,
                    success: false,
                    message: "Workflow not found",
                };
            }

            return {
                status: 200,
                success: true,
                message: "Workflow fetched successfully",
                data: workflow,
            };
        } catch (error) {
            throw new Error("Failed to fetch workflow: " + error.message);
        }
    },

    createWorkflow: async (payload) => {
        const {
            name,
            type,
            project,
            status,
            userId,
            xmlContent,
            jsonContent,
            workflowId,
            nodeData,
        } = payload;

        // Load file mặc định nếu không truyền xmlContent
        let finalXmlContent = xmlContent;
        if (!finalXmlContent) {
            const defaultPath = path.resolve("src", "resources", "newDiagram.bpmn");
            if (!fs.existsSync(defaultPath)) {
                throw new Error("Missing newDiagram.bpmn template file.");
            }
            finalXmlContent = fs.readFileSync(defaultPath, "utf8");
        }

        // Parse XML to JSON nếu chưa có jsonContent
        let finalJsonContent = jsonContent;
        if (!finalJsonContent && finalXmlContent) {
            try {
                finalJsonContent = xml2json.toJson(finalXmlContent, { object: true });
            } catch (err) {
                throw new Error("Failed to parse XML to JSON: " + err.message);
            }
        }

        try {
            const existing = await prisma.workflow.findFirst({
                where: { name },
            });

            if (existing) {
                return {
                    status: 409,
                    success: false,
                    message: "Workflow name already exists",
                };
            }

            const workflow = await prisma.workflow.create({
                data: {
                    name,
                    userId,
                    ...(type && { type }),
                    ...(project && { project }),
                    ...(status && { status }),
                    ...(finalXmlContent && { xmlContent: finalXmlContent }),
                    ...(finalJsonContent && { jsonContent: finalJsonContent }),
                    workflowNode: {
                        create: nodeData?.map((node) => ({
                            nodeId: node.nodeId,
                        })) || [],
                    },
                },
                include: {
                    workflowNode: true,
                },
            });
            // --- Tạo thêm node tự động từ bpmn:process nếu có ---
            if (
                finalJsonContent &&
                finalJsonContent['bpmn:definitions'] &&
                finalJsonContent['bpmn:definitions']['bpmn:process']
            ) {
                const process = finalJsonContent['bpmn:definitions']['bpmn:process'];
                let nodeIdSet = new Set();
                for (const [key, value] of Object.entries(process)) {
                    if (key === "bpmn:sequenceFlow") continue;
                    if (Array.isArray(value)) {
                        value.forEach(item => {
                            if (item.id) nodeIdSet.add(item.id);
                        });
                    } else if (value && typeof value === 'object' && value.id) {
                        nodeIdSet.add(value.id);
                    }
                }
                const nodeIds = Array.from(nodeIdSet);

                // Tạo node cho từng nodeId (chỉ tạo nếu chưa có)
                await Promise.all(nodeIds.map(nodeId =>
                    testCaseNodeService.createNode({
                        workflowId: workflow.id,
                        nodeId
                    })
                ));
            }

            // --- Lấy lại testcase để đảm bảo testCaseNodes mới nhất ---
            const newWorkflow = await prisma.workflow.findUnique({
                where: { id: workflow.id },
                include: { workflowNode: true },
            });

            return {
                status: 201,
                success: true,
                message: "Workflow created successfully",
                data: newWorkflow,
            };
        } catch (error) {
            throw new Error("Failed to create workflow: " + error.message);
        }
    },

    updateWorkflow: async ({ id, ...newData }) => {
        try {
            const existing = await prisma.workflow.findUnique({ where: { id } });
            if (!existing) {
                return {
                    status: 404,
                    success: false,
                    message: "Workflow not found",
                };
            }

            // So sánh và chỉ giữ các field thực sự thay đổi
            const dataToUpdate = Object.entries(newData).reduce((acc, [key, value]) => {
                if (value !== undefined && existing[key] !== value) {
                    acc[key] = value;
                }
                return acc;
            }, {});
            /*
            if (Object.keys(dataToUpdate).length === 0) {
                return {
                    status: 400,
                    success: false,
                    message: "No fields have been modified. Update aborted.",
                };
            }*/

            // Nếu có name mới → kiểm tra trùng
            if (dataToUpdate.name) {
                const nameExists = await prisma.workflow.findFirst({
                    where: {
                        name: dataToUpdate.name,
                        NOT: { id },
                    },
                });
                if (nameExists) {
                    return {
                        status: 409,
                        success: false,
                        message: "Another workflow with the same name already exists",
                    };
                }
            }

            const updated = await prisma.workflow.update({
                where: { id },
                data: dataToUpdate,
            });

            return {
                status: 200,
                success: true,
                message: "Workflow updated successfully",
                data: updated,
            };
        } catch (error) {
            throw new Error("Failed to update workflow: " + error.message);
        }
    },

    deleteWorkflow: async ({ id }) => {
        try {
            const existing = await prisma.workflow.findUnique({ where: { id } });
            if (!existing) {
                return {
                    status: 404,
                    success: false,
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
                status: 200,
                success: true,
                message: "Workflow deleted successfully",
            };
        } catch (error) {
            throw new Error("Failed to delete workflow: " + error.message);
        }
    },
};

export default workflowService;
