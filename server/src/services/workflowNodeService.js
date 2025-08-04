import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const workflowNodeService  = {
    getAllWorkflowNodes: async ({ workflowId, page, pageSize }) => {
        try {
            const workflow = await prisma.workflow .findUnique({
                where: { id: workflowId },
                select: { id: true, xmlContent: true },
            });

            if (!workflow) {
                return { status: 404, success: false, message: "Workflow  not found" };
            }

            const skip = page && pageSize ? (parseInt(page) - 1) * parseInt(pageSize) : undefined;
            const take = page && pageSize ? parseInt(pageSize) : undefined;

            const nodes = await prisma.workflowNode.findMany({
                where: { workflowId },
                select: {
                    nodeId: true,
                    configurationData: {
                        select: {
                            data: true,
                            description: true,
                            attachments: true,
                        }
                    }
                },
                skip,
                take,
            });

            const total = await prisma.workflowNode.count({ where: { workflowId } });

            const formattedNodes = nodes.map((n) => {
                const merged = n.configurationData
                    .filter(Boolean)
                    .reduce((acc, cur) => ({
                        ...acc,
                        ...cur.data,
                        ...(cur.description ? { description: cur.description } : {}),
                        ...(cur.attachments && cur.attachments.length > 0 ? { attachments: cur.attachments } : {})
                    }), {});
                return { nodeId: n.nodeId, configurationData: merged };
            });

            return {
                status: 200,
                success: true,
                data: {
                    workflowId: workflow.id,
                    xmlContent: workflow.xmlContent,
                    nodes: formattedNodes,
                    total,
                    page: page ? parseInt(page) : undefined,
                    pageSize: pageSize ? parseInt(pageSize) : undefined,
                },
            };
        } catch (error) {
            throw new Error("Failed to fetch workflow nodes: " + error.message);
        }
    },

    // Lấy toàn bộ node theo testCaseId
    getNodesByWorkflowId: async (workflowId) => {
        try {
            const workflow = await prisma.workflow.findUnique({
                where: { id: workflowId },
                select: {
                    id: true,
                    xmlContent: true,
                },
            });

            if (!workflow) {
                return {
                    status: 404,
                    success: false,
                    message: "Workflow not found",
                };
            }

            const nodes = await prisma.workflowNode.findMany({
                where: { workflowId },
                select: {
                    nodeId: true,
                    configurationData: {
                        select: {
                            data: true,
                            description: true,    // lấy ở đây
                            attachments: true     // lấy ở đây
                        }
                    }
                }
            });

            const formattedNodes = nodes.map((n) => {
                // gộp configurationData thành 1 object
                const merged = n.configurationData
                    .filter(Boolean)
                    .reduce((acc, cur) => ({
                        ...acc,
                        ...cur.data,
                        // merge description và attachments nếu có
                        ...(cur.description ? { description: cur.description } : {}),
                        ...(cur.attachments && cur.attachments.length > 0 ? { attachments: cur.attachments } : {})
                    }), {});

                return {
                    nodeId: n.nodeId,
                    configurationData: merged
                };
            });

            return {
                status: 200,
                data: {
                    workflowId: workflow.id,
                    xmlContent: workflow.xmlContent,
                    nodes: formattedNodes,
                },
            };
        } catch (error) {
            throw new Error("Failed to fetch workflow nodes: " + error.message);
        }
    },

    // Tạo node mới (nếu chưa có)
    createNode: async ({ workflowId, nodeId }) => {
        try {
            const existing = await prisma.workflowNode.findUnique({
                where: {
                    workflowId_nodeId: {
                        workflowId,
                        nodeId,
                    },
                },
            });

            if (existing) {
                return {
                    status: 409,
                    success: false,
                    message: "Node already exists in this workflow",
                };
            }

            const newNode = await prisma.workflowNode.create({
                data: { workflowId, nodeId },
            });

            return {
                status: 201,
                success: true,
                message: "Node created successfully",
                data: newNode,
            };
        } catch (error) {
            throw new Error("Failed to create node: " + error.message);
        }
    },

    // Xóa 1 node (và dữ liệu extra liên quan)
    deleteNode: async ({ workflowId, nodeId }) => {
        try {
            const node = await prisma.workflowNode.findUnique({
                where: {
                    workflowId_nodeId: {
                        workflowId,
                        nodeId,
                    },
                },
            });

            if (!node) {
                return {
                    status: 404,
                    success: false,
                    message: "Node not found",
                };
            }

            // Xóa configurationData trước
            await prisma.configurationData.deleteMany({
                where: { workflowNodeId: node.id },
            });

            // Xóa node
            await prisma.workflowNode.delete({
                where: { id: node.id },
            });

            return {
                status: 200,
                success: true,
                message: "Node deleted successfully",
            };
        } catch (error) {
            throw new Error("Failed to delete node: " + error.message);
        }
    },
    // Cập nhật nodeId mới
    updateNode: async ({ workflowId, oldNodeId, newNodeId }) => {
        try {
            if (!workflowId || !oldNodeId || !newNodeId) {
                return {
                    status: 400,
                    success: false,
                    message: "Missing required fields: workflowId, oldNodeId, newNodeId",
                };
            }

            // Tìm node hiện tại
            const existing = await prisma.workflowNode.findUnique({
                where: {
                    workflowId_nodeId: {
                        workflowId,
                        nodeId: oldNodeId,
                    },
                },
            });

            if (!existing) {
                return {
                    status: 404,
                    success: false,
                    message: "Node not found",
                };
            }

            // Kiểm tra node mới đã tồn tại chưa
            const conflict = await prisma.workflowNode.findUnique({
                where: {
                    workflowId_nodeId: {
                        workflowId,
                        nodeId: newNodeId,
                    },
                },
            });

            if (conflict) {
                return {
                    status: 409,
                    success: false,
                    message: "New nodeId already exists in this workflow",
                };
            }

            // Cập nhật nodeId
            const updated = await prisma.workflowNode.update({
                where: { id: existing.id },
                data: { nodeId: newNodeId },
            });

            return {
                status: 200,
                success: true,
                message: "Node updated successfully",
                data: updated,
            };
        } catch (error) {
            throw new Error("Failed to update node: " + error.message);
        }
    },
};

export default workflowNodeService;
